import { type BrowserContext, type Page } from '@playwright/test';
import { getAddress, keccak256, parseUnits, toHex, type Address } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';
import { mockRpcCalls } from '../mock-rpc-call';
import { mockGeoConfig } from '../mock-geo-config';
import { isSafeServiceUrl, noSafeServiceHandler } from '../mock-safe-service';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { watchDeposit } from '../utils/bridgeFunds';
import { awaitDepositTxHash, relayOpStackDeposit } from '../utils/bridgeRelay';
import { installArbitrumShim } from '../utils/arbitrumShim';

// APP-643 pending list, persistence and accounts, on the native deposit route. Writes go to
// OP Mainnet and Arbitrum: no other spec closes those bridges.

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';
const KEY_PREFIX = 'bridgePending:v1:';
const AMOUNT = parseUnits('1', 18);

/** Mock builds clear localStorage on every load (config.e2e.ts); this keeps the pending bridges, as a real reload does. */
const keepPendingBridgesOnLoad = (context: BrowserContext) =>
  context.addInitScript(prefix => {
    Storage.prototype.clear = function (this: Storage) {
      for (const key of Object.keys(this)) if (!key.startsWith(prefix)) this.removeItem(key);
    };
  }, KEY_PREFIX);

/** Another tab in the same browser, with the fixture's mocks. */
async function secondTab(page: Page) {
  const tab = await page.context().newPage();
  await tab.route(TENDERLY_RPC, mockRpcCalls);
  await tab.route('**/geo-config', mockGeoConfig);
  await tab.route(isSafeServiceUrl, noSafeServiceHandler([]));
  return tab;
}

async function deposit(bridge: BridgePage, page: Page, to: 'optimism' | 'arbitrum') {
  await bridge.selectDestination(to);
  await bridge.openReview('1');
  await bridge.confirmButton().click();
  await expectTransactionSuccess(page, { title: 'Bridge initiated!', timeout: 90_000 });
  return awaitDepositTxHash(page, to);
}

/** A failed OP relay, so the card waits on a Replay. */
async function depositNeedingReplay(page: Page, account: Address) {
  const bridge = new BridgePage(page);
  await bridge.gotoConnected();
  const funds = await watchDeposit({ to: 'optimism', sender: account });
  const txHash = await deposit(bridge, page, 'optimism');
  await funds.expectEscrowed(txHash, AMOUNT);
  expect(await relayOpStackDeposit('optimism', txHash, { gas: 150_000n })).toContain('FailedRelayedMessage');
  const card = bridge.card('OP Mainnet');
  await expect(card.getByTestId('pending-bridge-status')).toHaveText('Action needed', { timeout: 90_000 });
  return { bridge, card, funds };
}

const status = (bridge: BridgePage, network: string) =>
  bridge.card(network).getByTestId('pending-bridge-status');

test.describe('Bridge: pending list, persistence and accounts', () => {
  test('A reload restores the card at each stage, and tracking continues to delivery', async ({
    isolatedPage,
    testAccount
  }) => {
    await keepPendingBridgesOnLoad(isolatedPage.context());
    const account = getAddress(testAccount);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    const funds = await watchDeposit({ to: 'optimism', sender: account });
    const txHash = await deposit(bridge, isolatedPage, 'optimism');
    await funds.expectEscrowed(txHash, AMOUNT);

    await bridge.gotoConnected();
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Pending', { timeout: 30_000 });
    expect(await awaitDepositTxHash(isolatedPage, 'optimism')).toBe(txHash);

    expect(await relayOpStackDeposit('optimism', txHash, { gas: 150_000n })).toContain(
      'FailedRelayedMessage'
    );
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Action needed', { timeout: 90_000 });

    await bridge.gotoConnected();
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Action needed', { timeout: 60_000 });
    const replay = bridge.card('OP Mainnet').getByTestId('pending-bridge-action');
    await expect(replay).toHaveText('Replay');
    await replay.click();
    await expectTransactionSuccess(isolatedPage, { title: 'Replay sent!', timeout: 90_000 });
    await expect(() => funds.expectArrived(AMOUNT)).toPass({ timeout: 30_000 });
  });

  test('After storage is cleared, the deposit scan finds the bridge again and tracks it to Arrived', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    const funds = await watchDeposit({ to: 'optimism', sender: account });
    const txHash = await deposit(bridge, isolatedPage, 'optimism');
    await funds.expectEscrowed(txHash, AMOUNT);

    // The mock build clears localStorage on load, so this reload starts with an empty store.
    await bridge.gotoConnected();
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Pending', { timeout: 60_000 });
    expect(await awaitDepositTxHash(isolatedPage, 'optimism')).toBe(txHash);
    await expect(bridge.cards()).toHaveCount(1);

    expect(await relayOpStackDeposit('optimism', txHash)).toContain('RelayedMessage');
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Arrived', { timeout: 60_000 });
    await expect(bridge.cards()).toHaveCount(1);
    await funds.expectArrived(AMOUNT);
  });

  test('With two tabs open, a Replay sent from one is not offered again in the other', async ({
    isolatedPage,
    testAccount
  }) => {
    await keepPendingBridgesOnLoad(isolatedPage.context());
    const { card, funds } = await depositNeedingReplay(isolatedPage, getAddress(testAccount));

    const tab = await secondTab(isolatedPage);
    const otherSends: string[] = [];
    tab.on('request', request => {
      if (request.postData()?.includes('"eth_sendTransaction"')) otherSends.push(request.url());
    });
    const other = new BridgePage(tab);
    await other.gotoConnected();
    const otherAction = other.card('OP Mainnet').getByTestId('pending-bridge-action');
    await expect(otherAction).toHaveText('Replay', { timeout: 60_000 });

    await isolatedPage.bringToFront();
    await card.getByTestId('pending-bridge-action').click();
    await expectTransactionSuccess(isolatedPage, { title: 'Replay sent!', timeout: 90_000 });

    // The replay can land before tab B renders the sent state, so either is fine: just never an enabled Replay.
    await tab.bringToFront();
    await expect
      .poll(async () => (await otherAction.count()) === 0 || (await otherAction.isDisabled()), {
        timeout: 30_000
      })
      .toBe(true);
    await expect(status(other, 'OP Mainnet')).toHaveText('Arrived', { timeout: 60_000 });
    await expect(otherAction).toHaveCount(0);
    expect(otherSends).toEqual([]);
    await expect(() => funds.expectArrived(AMOUNT)).toPass({ timeout: 30_000 });
  });

  test('Only the connected account on its chain family sees its bridges', async ({
    isolatedPage,
    testAccount
  }) => {
    await keepPendingBridgesOnLoad(isolatedPage.context());
    const account = getAddress(testAccount);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await deposit(bridge, isolatedPage, 'optimism');
    await expect(bridge.cards()).toHaveCount(1);

    // The same entry, as another account's on the fork and as this account's on mainnet.
    const other = '0x00000000000000000000000000000000000e2e01';
    await isolatedPage.evaluate(
      ({ prefix, own, scopes, fakeHash }) => {
        const [entry] = JSON.parse(localStorage.getItem(prefix + own) ?? '[]');
        for (const scope of scopes)
          localStorage.setItem(
            prefix + scope,
            JSON.stringify([{ ...entry, id: `${entry.id}-${scope}`, txHash: fakeHash }])
          );
      },
      {
        prefix: KEY_PREFIX,
        own: `${TENDERLY_CHAIN_ID}:${account.toLowerCase()}`,
        scopes: [`${TENDERLY_CHAIN_ID}:${other}`, `1:${account.toLowerCase()}`],
        fakeHash: keccak256(toHex('e2e: foreign scope'))
      }
    );
    await bridge.gotoConnected();
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Pending', { timeout: 30_000 });
    await expect(bridge.cards()).toHaveCount(1);
  });

  test('While the deposit is minimized, the form is locked until it is restored', async ({
    isolatedPage,
    testAccount
  }) => {
    // Receipts are held, so the approve stays in flight while the modal is minimized.
    let holding = true;
    await isolatedPage.route(TENDERLY_RPC, route => {
      const body = route.request().postData();
      if (!holding || !body?.includes('"eth_getTransactionReceipt"')) return route.fallback();
      const request = JSON.parse(body);
      if (Array.isArray(request)) return route.fallback();
      return route.fulfill({ json: { jsonrpc: '2.0', id: request.id, result: null } });
    });
    const account = getAddress(testAccount);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected({ batch: false });
    await bridge.selectDestination('optimism');
    const funds = await watchDeposit({ to: 'optimism', sender: account });
    await bridge.openReview('1');
    await bridge.confirmButton().click();
    // Closing only minimizes once the approve is broadcast; before that it abandons the flow.
    const close = isolatedPage.getByTestId('transaction-modal-close');
    await expect(close).toHaveAttribute('aria-label', 'Minimize', { timeout: 30_000 });
    await close.click();

    const toast = isolatedPage.getByTestId('minimized-transaction-toast');
    await expect(toast).toBeVisible();
    await expect(isolatedPage.getByTestId('bridge-locked')).toHaveText(
      'A transaction is in progress. Open it to continue.'
    );
    await expect(isolatedPage.getByTestId('bridge-form')).toHaveAttribute('inert', '');

    await toast.click();
    await expect(bridge.modalReview().or(isolatedPage.getByTestId('transaction-status-badge'))).toBeVisible();
    holding = false;
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    await expect(isolatedPage.getByTestId('bridge-locked')).toHaveCount(0);
    await funds.expectEscrowed(await awaitDepositTxHash(isolatedPage, 'optimism'), AMOUNT);
  });

  test('Bridges on two routes at once are each tracked on their own', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const shim = await installArbitrumShim(isolatedPage);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    const opFunds = await watchDeposit({ to: 'optimism', sender: account });
    const opHash = await deposit(bridge, isolatedPage, 'optimism');
    await opFunds.expectEscrowed(opHash, AMOUNT);
    const arbFunds = await watchDeposit({ to: 'arbitrum', sender: account });
    const arbHash = await deposit(bridge, isolatedPage, 'arbitrum');
    await arbFunds.expectEscrowed(arbHash, AMOUNT);
    await expect(bridge.cards()).toHaveCount(2);

    expect((await shim.relay(arbHash)).minted).toBe(true);
    await expect(status(bridge, 'Arbitrum One')).toHaveText('Arrived', { timeout: 60_000 });
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Pending');
    await arbFunds.expectArrived(AMOUNT);

    expect(await relayOpStackDeposit('optimism', opHash)).toContain('RelayedMessage');
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Arrived', { timeout: 60_000 });
    await expect(status(bridge, 'Arbitrum One')).toHaveText('Arrived');
    await opFunds.expectArrived(AMOUNT);
  });

  test('The ETA counts down with the clock and says when the bridge is late', async ({
    isolatedPage,
    testAccount
  }) => {
    await isolatedPage.clock.install();
    const account = getAddress(testAccount);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    const funds = await watchDeposit({ to: 'optimism', sender: account });
    const txHash = await deposit(bridge, isolatedPage, 'optimism');
    const card = bridge.card('OP Mainnet');
    await expect(card).toContainText(/~\d+ min/, { timeout: 30_000 });

    await isolatedPage.clock.fastForward('02:00:00');
    await expect(card).toContainText('Taking longer than expected', { timeout: 30_000 });
    await expect(status(bridge, 'OP Mainnet')).toHaveText('Pending');

    expect(await relayOpStackDeposit('optimism', txHash)).toContain('RelayedMessage');
    // The tracker's next poll sits on the fake clock, so keep it moving.
    await expect(async () => {
      await isolatedPage.clock.fastForward('01:00');
      await expect(status(bridge, 'OP Mainnet')).toHaveText('Arrived', { timeout: 2_000 });
    }).toPass({ timeout: 90_000 });
    await funds.expectEscrowed(txHash, AMOUNT);
    await funds.expectArrived(AMOUNT);
  });
});
