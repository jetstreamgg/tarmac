import { type Page, type Route } from '@playwright/test';
import { createPublicClient, erc20Abi, getAddress, http, parseUnits, type Address } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { L1_USDS, l1DepositBridge } from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { watchDeposit } from '../utils/bridgeFunds';
import { awaitDepositTxHash, l1AccountState, pendingDepositTxHash } from '../utils/bridgeRelay';
import { getRpcUrlFromFile } from '../utils/getRpcUrlFromFile';
import { NetworkName } from '../utils/constants';

// APP-643 wallets: rejects and a disconnect mid-flow. A source the wallet isn't on is in
// bridge-native-form (only Ethereum is a live source), a wallet that can't switch in bridge-native-safe.
// Writes go to OP Mainnet: no other spec closes that bridge.

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';
const AMOUNT = parseUnits('1', 18);
const REJECTED = { jsonrpc: '2.0', id: 1, error: { code: 4001, message: 'User rejected the request.' } };

const sendTo = (body: string | null) =>
  body?.includes('"eth_sendTransaction"') ? getAddress(JSON.parse(body).params[0].to) : undefined;

/** Routes each wallet send through `handle`, by its target; anything else goes to the fork. Returns the removal. */
async function onSends(page: Page, handle: (to: Address, route: Route) => unknown) {
  const handler = (route: Route) => {
    const to = sendTo(route.request().postData());
    return to ? handle(to, route) : route.fallback();
  };
  await page.route(TENDERLY_RPC, handler);
  return () => page.unroute(TENDERLY_RPC, handler);
}

async function usdsAllowance(owner: Address, spender: Address) {
  const l1 = createPublicClient({ transport: http(await getRpcUrlFromFile(NetworkName.mainnet)) });
  return l1.readContract({
    address: L1_USDS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, spender]
  });
}

/** No deposit left Ethereum: no pending entry, no card, the USDS untouched, only `approves` mined. */
async function expectNoBridge(
  bridge: BridgePage,
  page: Page,
  account: Address,
  before: Awaited<ReturnType<typeof l1AccountState>>,
  { approves = 0 } = {}
) {
  expect(await pendingDepositTxHash(page, 'optimism')).toBeUndefined();
  await expect(bridge.cards()).toHaveCount(0);
  const after = await l1AccountState(account);
  expect(after.usds).toBe(before.usds);
  expect(after.nonce).toBe(before.nonce + approves);
}

test.describe('Bridge: wallets', () => {
  test('Rejecting the approve sends nothing and leaves no card', async ({ isolatedPage, testAccount }) => {
    const account = getAddress(testAccount);
    const spender = l1DepositBridge('optimism');
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected({ batch: false });
    await bridge.selectDestination('optimism');
    const before = await l1AccountState(account);
    const allowance = await usdsAllowance(account, spender);
    await bridge.openReview('1');

    const sent: Address[] = [];
    await onSends(isolatedPage, (to, route) => {
      sent.push(to);
      return route.fulfill({ json: REJECTED });
    });
    await bridge.confirmButton().click();
    const dialog = isolatedPage.getByRole('dialog');
    await expect(dialog).toContainText('Approve declined', { timeout: 60_000 });
    await expect(dialog).toContainText('You declined the request in your wallet. Nothing was sent.');

    expect(sent).toEqual([L1_USDS]);
    await expectNoBridge(bridge, isolatedPage, account, before);
    expect(await usdsAllowance(account, spender)).toBe(allowance);
  });

  test('Rejecting the bridge after the approve leaves no card, keeps the approve reported, and Try again only bridges', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const spender = l1DepositBridge('optimism');
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected({ batch: false });
    await bridge.selectDestination('optimism');
    const before = await l1AccountState(account);
    await bridge.openReview('1');

    const sent: Address[] = [];
    const stopRejecting = await onSends(isolatedPage, (to, route) => {
      sent.push(to);
      return to === L1_USDS ? route.fallback() : route.fulfill({ json: REJECTED });
    });
    await bridge.confirmButton().click();
    const dialog = isolatedPage.getByRole('dialog');
    await expect(dialog).toContainText('Bridge declined', { timeout: 60_000 });
    await expect(dialog).not.toContainText('Approve declined');

    expect(sent).toEqual([L1_USDS, spender]);
    await expectNoBridge(bridge, isolatedPage, account, before, { approves: 1 });
    // The approve mined: the allowance stays on chain, for the retry to use.
    expect(await usdsAllowance(account, spender)).toBe(AMOUNT);

    await stopRejecting();
    sent.length = 0;
    await onSends(isolatedPage, (to, route) => {
      sent.push(to);
      return route.fallback();
    });
    const funds = await watchDeposit({ to: 'optimism', sender: account });
    await dialog.getByRole('button', { name: 'Try again' }).click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    expect(sent).toEqual([spender]);
    await expect(bridge.cards()).toHaveCount(1, { timeout: 30_000 });
    await funds.expectEscrowed(await awaitDepositTxHash(isolatedPage, 'optimism'), AMOUNT);
    expect((await l1AccountState(account)).usds).toBe(before.usds - AMOUNT);
  });

  test('Disconnecting while the bridge waits in the wallet leaves no half-recorded bridge', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const spender = l1DepositBridge('optimism');
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected({ batch: false });
    await bridge.selectDestination('optimism');
    const before = await l1AccountState(account);
    await bridge.openReview('1');

    // The bridge send waits in the wallet; the disconnect drops it unsigned.
    const held: Route[] = [];
    const stopHolding = await onSends(isolatedPage, (to, route) =>
      to === L1_USDS ? route.fallback() : held.push(route)
    );
    await bridge.confirmButton().click();
    await expect.poll(() => held.length, { timeout: 60_000 }).toBe(1);

    // Nothing is broadcast yet, so the modal closes instead of minimizing.
    await isolatedPage.getByTestId('transaction-modal-close').click();
    await expect(isolatedPage.getByRole('dialog')).toHaveCount(0);
    await isolatedPage.getByTestId('wallet-chip').click();
    await isolatedPage.getByTestId('wallet-drawer-disconnect').click();
    await expect(isolatedPage.getByTestId('wallet-chip')).not.toContainText(/0x/, { timeout: 15_000 });
    await held[0].abort();

    await expect(bridge.cards()).toHaveCount(0);
    expect(await pendingDepositTxHash(isolatedPage, 'optimism')).toBeUndefined();
    await stopHolding();
    await bridge.gotoConnected({ batch: false });
    await expectNoBridge(bridge, isolatedPage, account, before, { approves: 1 });
    expect(await usdsAllowance(account, spender)).toBe(AMOUNT);
  });
});
