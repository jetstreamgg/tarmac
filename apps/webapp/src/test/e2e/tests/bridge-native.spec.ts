import { type Page, type Route } from '@playwright/test';
import {
  createPublicClient,
  decodeFunctionData,
  getAddress,
  http,
  parseUnits,
  type Address,
  type Hex
} from 'viem';
import { skyL1TokenBridgeImplementationAbi } from '@/hooks/generated';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { L1_USDS, OP_STACK_DEPOSIT } from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { NetworkName } from '../utils/constants';
import { getRpcUrlFromFile } from '../utils/getRpcUrlFromFile';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';
import { watchDeposit } from '../utils/bridgeFunds';
import {
  awaitDepositTxHash,
  closeOpStackBridge,
  l1AccountState,
  l2UsdsBalance,
  pendingDepositTxHash,
  relayOpStackDeposit
} from '../utils/bridgeRelay';

// Ethereum → L2 native USDS deposits on the Bridge tab (APP-613). The L2 forks
// never derive deposits from the L1 fork, so each spec relays the deposit tx
// itself (`relayOpStackDeposit`). Serial: the bridge-closed case flips the
// shared Base bridge, which the other cases deposit through.
test.describe.configure({ mode: 'serial' });

const BASE_L2_USDS = '0x820C137fa70C8691f0e44Dc420a5e53c168921Dc';
// The Maker Vat: a contract on Ethereum with no code on Base.
const L1_ONLY_CONTRACT = '0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B';

test.describe('Bridge: Ethereum to L2 native deposits', () => {
  test('Base: review, confirm, then the card follows the relay to Arrived', async ({
    isolatedPage,
    testAccount
  }) => {
    // The prices API is unreachable from the test browser; the fee needs an ETH price.
    await isolatedPage.route(
      url => url.pathname.endsWith('/prices/'),
      route =>
        route.fulfill({
          json: [
            {
              underlying_address: '0x0000000000000000000000000000000000000000',
              underlying_symbol: 'WETH',
              price: '2500',
              datetime: new Date().toISOString(),
              source: 'e2e'
            }
          ]
        })
    );
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('base');
    const before = await l2UsdsBalance('base', testAccount);
    const funds = await watchDeposit({ to: 'base', sender: testAccount });

    await bridge.openReview('5');
    await expect(isolatedPage.getByRole('dialog')).toContainText('Review USDS bridge');
    await expect(bridge.modalRow('Bridge type')).toContainText('SkyLink');
    await expect(bridge.modalRow('Network fee')).toContainText(/\$\d/, { timeout: 30_000 });

    const bundles = countBundles(isolatedPage);
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    expect(bundles()).toBe(1);

    const card = bridge.card('Base');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending', { timeout: 30_000 });

    const txHash = await awaitDepositTxHash(isolatedPage, 'base');
    await funds.expectEscrowed(txHash, parseUnits('5', 18));
    expect(await relayOpStackDeposit('base', txHash)).toContain('RelayedMessage');

    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Arrived', { timeout: 60_000 });
    await expect(bridge.cards()).toHaveCount(1);
    expect((await l2UsdsBalance('base', testAccount)) - before).toBe(parseUnits('5', 18));
    await funds.expectArrived(parseUnits('5', 18));
  });

  test('OP Mainnet: a failed relay asks for a Replay that delivers the funds', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');
    const before = await l2UsdsBalance('optimism', testAccount);
    const funds = await watchDeposit({ to: 'optimism', sender: testAccount });

    await bridge.openReview('3');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });

    const txHash = await awaitDepositTxHash(isolatedPage, 'optimism');
    await funds.expectEscrowed(txHash, parseUnits('3', 18));
    // Too little gas for the token bridge's mint: the messenger records the message as failed.
    expect(await relayOpStackDeposit('optimism', txHash, { gas: 150_000n })).toContain(
      'FailedRelayedMessage'
    );

    const card = bridge.card('OP Mainnet');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Action needed', { timeout: 90_000 });
    await expect(card.getByTestId('pending-bridge-note')).toBeVisible();
    const replay = card.getByTestId('pending-bridge-action');
    await expect(replay).toHaveText('Replay');

    await replay.click();
    await expectTransactionSuccess(isolatedPage, { title: 'Replay sent!', timeout: 90_000 });

    // The replay leaves the wallet on OP, outside the Ethereum fork's pending scope (fork ids differ
    // from mainnet's), so the card hides; the delivery is read on chain instead.
    await expect
      .poll(async () => (await l2UsdsBalance('optimism', testAccount)) - before, { timeout: 30_000 })
      .toBe(parseUnits('3', 18));
    await funds.expectArrived(parseUnits('3', 18));
  });

  test('Recipients that would trap the funds are refused', async ({ isolatedPage }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('base');

    await bridge.setRecipient('0x0000000000000000000000000000000000000000');
    await expect(bridge.recipientError()).toHaveText('Enter a valid address.');
    await expect(bridge.recipientSave()).toBeDisabled();

    await bridge.recipientInput().fill(BASE_L2_USDS);
    await expect(bridge.recipientError()).toContainText('token or bridge contract');
    await expect(bridge.recipientSave()).toBeDisabled();

    await bridge.recipientInput().fill(L1_ONLY_CONTRACT);
    await bridge.recipientSave().click();
    await bridge.fromAmount().fill('1');
    await expect(bridge.recipientBlocked()).toContainText("doesn't exist on the destination network", {
      timeout: 30_000
    });
    await expect(bridge.reviewCta()).toBeDisabled();
  });

  test('A closed bridge blocks Review', async ({ isolatedPage }) => {
    const reopen = await closeOpStackBridge('base');
    try {
      const bridge = new BridgePage(isolatedPage);
      await bridge.gotoConnected();
      await bridge.selectDestination('base');
      await bridge.fromAmount().fill('1');
      await expect(bridge.blocked()).toHaveText('This route is temporarily unavailable.', {
        timeout: 30_000
      });
      await expect(bridge.reviewCta()).toBeDisabled();
    } finally {
      await reopen();
    }
  });

  test('A bridge that closes after Review sends nothing on Confirm, and Try again sends once it reopens', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('unichain');
    const before = await l1AccountState(testAccount);
    await bridge.openReview('1');
    await expect(bridge.confirmButton()).toBeEnabled({ timeout: 30_000 });

    // Closed after the gate's last poll and the send's simulation: only the read on Confirm can see it.
    const reopen = await closeOpStackBridge('unichain');
    try {
      await bridge.confirmButton().click();
      // A refusal before signing says nothing was sent, with the reason.
      const dialog = isolatedPage.getByRole('dialog');
      await expect(dialog).toContainText('Transaction not sent', { timeout: 60_000 });
      await expect(dialog).toContainText('The bridge is closed to new deposits. Nothing was sent.');
      await expectNothingSent(bridge, isolatedPage, testAccount, before);
    } finally {
      await reopen();
    }
    await retryOnce(bridge, isolatedPage, testAccount, before);
  });

  test('A send rejected in the wallet leaves nothing pending, and Try again sends it once', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('unichain');
    const before = await l1AccountState(testAccount);
    await bridge.openReview('1');

    // EIP-1193 4001, what a wallet returns when the user rejects.
    const stop = await routeRpc(isolatedPage, route =>
      isSend(route.request().postData())
        ? route.fulfill({
            json: { jsonrpc: '2.0', id: 1, error: { code: 4001, message: 'User rejected the request.' } }
          })
        : route.fallback()
    );
    await bridge.confirmButton().click();
    await expect(isolatedPage.getByRole('dialog')).toContainText(
      'You declined the bundled transaction in your wallet.',
      { timeout: 60_000 }
    );

    await expectNothingSent(bridge, isolatedPage, testAccount, before);
    await stop();
    await retryOnce(bridge, isolatedPage, testAccount, before);
  });

  test('A send that fails after the approve leaves nothing pending, and Try again sends it once', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('unichain');
    const before = await l1AccountState(testAccount);
    await bridge.openReview('1');

    // The mock wallet sends a batch leg by leg: any approve mines, the deposit never reaches the node.
    let approves = 0;
    let deposits = 0;
    const stop = await routeRpc(isolatedPage, route => {
      const body = route.request().postData();
      if (!isSend(body)) return route.fallback();
      const to = JSON.parse(body!).params[0].to as string;
      if (to.toLowerCase() === L1_USDS.toLowerCase()) {
        approves++;
        return route.fallback();
      }
      deposits++;
      return route.abort();
    });
    await bridge.confirmButton().click();
    await expect(isolatedPage.getByRole('dialog')).toContainText('Transaction failed', { timeout: 60_000 });
    expect(deposits).toBe(1);

    await expectNothingSent(bridge, isolatedPage, testAccount, before, { approves });
    await stop();
    await retryOnce(bridge, isolatedPage, testAccount, before);
  });

  test('A wallet without bundles signs each leg on its own, and the card gets the deposit hash', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected({ batch: false });
    await bridge.selectDestination('unichain');
    const before = await l1AccountState(testAccount);
    const funds = await watchDeposit({ to: 'unichain', sender: testAccount });
    await bridge.openReview('1');

    let sends = 0;
    await isolatedPage.route(TENDERLY_RPC, route => {
      if (isSend(route.request().postData())) sends++;
      return route.fallback();
    });
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    await expect(bridge.cards()).toHaveCount(1, { timeout: 30_000 });
    const txHash = await pendingDepositTxHash(isolatedPage, 'unichain');
    expect(txHash).toBeTruthy();
    await funds.expectEscrowed(txHash!, parseUnits('1', 18));

    const after = await l1AccountState(testAccount);
    expect(after.usds).toBe(before.usds - parseUnits('1', 18));
    expect(sends).toBeGreaterThanOrEqual(1);
    expect(after.nonce).toBe(before.nonce + sends);
  });

  test('A bundle whose receipt never reached the tab keeps its card, and the deposit scan fills it after a reload', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('base');
    const funds = await watchDeposit({ to: 'base', sender: testAccount });
    await bridge.openReview('2');

    // The wallet sends the bundle, but its status never comes back: the tab closes before the receipt.
    const stop = await routeRpc(isolatedPage, route =>
      route.request().postData()?.includes('"eth_getTransactionReceipt"') ? undefined : route.fallback()
    );
    await bridge.confirmButton().click();
    const card = bridge.card('Base');
    await expect(card).toContainText('Confirming on Ethereum', { timeout: 60_000 });
    expect(await pendingDepositTxHash(isolatedPage, 'base')).toBeUndefined();

    await stop();
    await bridge.gotoConnected();
    const txHash = await awaitDepositTxHash(isolatedPage, 'base');
    await expect(bridge.card('Base')).not.toContainText('Confirming on Ethereum');
    // The scan fills the bundle's card instead of adding a second one for its deposit.
    await expect(bridge.cards()).toHaveCount(1);
    await funds.expectEscrowed(txHash, parseUnits('2', 18));
    expect(await relayOpStackDeposit('base', txHash)).toContain('RelayedMessage');
    await expect(bridge.card('Base').getByTestId('pending-bridge-status')).toHaveText('Arrived', {
      timeout: 60_000
    });
    await expect(bridge.cards()).toHaveCount(1);
    await funds.expectArrived(parseUnits('2', 18));
  });

  for (const { network, label } of [
    { network: 'optimism', label: 'OP Mainnet' },
    { network: 'unichain', label: 'Unichain' }
  ] as const) {
    test(`${label}: the deposit sends the expected bridge call, and the card follows the relay to Arrived`, async ({
      isolatedPage,
      testAccount
    }) => {
      const account = getAddress(testAccount);
      const amount = parseUnits('1', 18);
      const bridge = new BridgePage(isolatedPage);
      await bridge.gotoConnected();
      await bridge.selectDestination(network);
      const before = await l2UsdsBalance(network, account);
      const funds = await watchDeposit({ to: network, sender: account });
      const sent: { to: Address; data: Hex; value: bigint }[] = [];
      await routeRpc(isolatedPage, route => {
        const body = route.request().postData();
        if (isSend(body)) {
          const tx = JSON.parse(body!).params[0];
          sent.push({ to: getAddress(tx.to), data: tx.data ?? tx.input, value: BigInt(tx.value ?? 0) });
        }
        return route.fallback();
      });

      await bridge.openReview('1');
      await bridge.confirmButton().click();
      await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
      const deposit = sent.at(-1)!;
      expect(deposit.value).toBe(0n);
      // The token pair the bridge itself maps, read on Ethereum, not the app's config.
      const l1 = createPublicClient({ transport: http(await getRpcUrlFromFile(NetworkName.mainnet)) });
      const read = (functionName: 'otherBridge' | 'l1ToL2Token', args?: [Address]) =>
        l1.readContract({
          address: deposit.to,
          abi: skyL1TokenBridgeImplementationAbi,
          functionName,
          args
        } as never) as Promise<Address>;
      expect(deposit.to).toBe(getAddress(OP_STACK_DEPOSIT[network].l1TokenBridge));
      expect(getAddress(await read('otherBridge'))).toBe(getAddress(OP_STACK_DEPOSIT[network].l2TokenBridge));
      const remoteToken = getAddress(await read('l1ToL2Token', [L1_USDS]));
      expect(decodeFunctionData({ abi: skyL1TokenBridgeImplementationAbi, data: deposit.data })).toEqual({
        functionName: 'bridgeERC20To',
        args: [getAddress(L1_USDS), remoteToken, account, amount, 300_000, '0x']
      });

      const txHash = await awaitDepositTxHash(isolatedPage, network);
      await funds.expectEscrowed(txHash, amount);
      expect(await relayOpStackDeposit(network, txHash)).toContain('RelayedMessage');
      await expect(bridge.card(label).getByTestId('pending-bridge-status')).toHaveText('Arrived', {
        timeout: 60_000
      });
      expect((await l2UsdsBalance(network, account)) - before).toBe(amount);
      await funds.expectArrived(amount);
    });
  }

  test('OP Mainnet: a Replay declined in the wallet keeps Action needed, and the Replay sent after delivers', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');
    const before = await l2UsdsBalance('optimism', testAccount);
    const funds = await watchDeposit({ to: 'optimism', sender: testAccount });
    await bridge.openReview('1');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    const txHash = await awaitDepositTxHash(isolatedPage, 'optimism');
    await funds.expectEscrowed(txHash, parseUnits('1', 18));
    expect(await relayOpStackDeposit('optimism', txHash, { gas: 150_000n })).toContain(
      'FailedRelayedMessage'
    );
    const card = bridge.card('OP Mainnet');
    const status = card.getByTestId('pending-bridge-status');
    const replay = card.getByTestId('pending-bridge-action');
    await expect(status).toHaveText('Action needed', { timeout: 90_000 });

    let declined = 0;
    const stop = await routeRpc(isolatedPage, route => {
      if (!isSend(route.request().postData())) return route.fallback();
      declined++;
      return route.fulfill({
        json: { jsonrpc: '2.0', id: 1, error: { code: 4001, message: 'User rejected the request.' } }
      });
    });
    await replay.click();
    await expect(isolatedPage.getByRole('dialog')).toContainText('declined', { timeout: 60_000 });
    expect(declined).toBe(1);
    await isolatedPage.getByTestId('transaction-modal-close').click();
    await switchBackToEthereum(isolatedPage);
    await expect(status).toHaveText('Action needed');
    await expect(replay).toBeEnabled();
    expect(await l2UsdsBalance('optimism', testAccount)).toBe(before);

    await stop();
    await replay.click();
    await expectTransactionSuccess(isolatedPage, { title: 'Replay sent!', timeout: 90_000 });
    await expect
      .poll(async () => (await l2UsdsBalance('optimism', testAccount)) - before, { timeout: 30_000 })
      .toBe(parseUnits('1', 18));
    await funds.expectArrived(parseUnits('1', 18));
  });

  test('A bridge closed after the deposit is sent still delivers it: the L2 side never checks isOpen', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('unichain');
    const before = await l2UsdsBalance('unichain', testAccount);
    const funds = await watchDeposit({ to: 'unichain', sender: testAccount });
    await bridge.openReview('1');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    const txHash = await awaitDepositTxHash(isolatedPage, 'unichain');
    await funds.expectEscrowed(txHash, parseUnits('1', 18));

    const reopen = await closeOpStackBridge('unichain');
    try {
      expect(await relayOpStackDeposit('unichain', txHash)).toContain('RelayedMessage');
      await expect(bridge.card('Unichain').getByTestId('pending-bridge-status')).toHaveText('Arrived', {
        timeout: 60_000
      });
      expect((await l2UsdsBalance('unichain', testAccount)) - before).toBe(parseUnits('1', 18));
      await funds.expectArrived(parseUnits('1', 18));
    } finally {
      await reopen();
    }
  });

  test('A deposit that reverts on Ethereum reads Failed, with nothing to do on the L2', async ({
    isolatedPage
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('unichain');
    await bridge.openReview('1');

    // The fork can't revert the deposit after its simulation passed, so its receipt reads reverted to this page.
    const depositBridge = getAddress(OP_STACK_DEPOSIT.unichain.l1TokenBridge);
    const reverted = new Set<string>();
    await routeRpc(isolatedPage, async route => {
      const body = route.request().postData();
      if (!body) return route.fallback();
      const request = JSON.parse(body);
      if (Array.isArray(request)) return route.fallback();
      if (request.method === 'eth_sendTransaction' && getAddress(request.params[0].to) === depositBridge) {
        const response = await route.fetch();
        const answer = await response.json();
        if (answer.result) reverted.add(String(answer.result).toLowerCase());
        return route.fulfill({ response, json: answer });
      }
      if (
        request.method === 'eth_getTransactionReceipt' &&
        reverted.has(String(request.params[0]).toLowerCase())
      ) {
        const response = await route.fetch();
        const answer = await response.json();
        if (!answer.result) return route.fulfill({ response, json: answer });
        return route.fulfill({
          response,
          json: { ...answer, result: { ...answer.result, status: '0x0', logs: [] } }
        });
      }
      return route.fallback();
    });
    await bridge.confirmButton().click();
    await expect.poll(() => reverted.size, { timeout: 60_000 }).toBe(1);

    const card = bridge.card('Unichain');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Failed', { timeout: 90_000 });
    await expect(card.getByTestId('pending-bridge-action')).toHaveCount(0);
  });
});

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';

/** The wallet back on Ethereum, where the deposit cards are scoped, after an action sent on the L2. */
const switchBackToEthereum = (page: Page) =>
  switchWalletNetwork(page, tenderlyChainLabel(NetworkName.mainnet));

const isSend = (body: string | null) => !!body?.includes('"eth_sendTransaction"');

/** Routes the fork's RPC through `handler`. Returns its removal, which leaves the fixture's routes in place. */
async function routeRpc(page: Page, handler: (route: Route) => unknown) {
  await page.route(TENDERLY_RPC, handler);
  return () => page.unroute(TENDERLY_RPC, handler);
}

/** Counts the bundles the batch mock wallet was asked to send (it logs every request). */
function countBundles(page: Page) {
  let bundles = 0;
  page.on('console', message => {
    if (message.text().startsWith('extendedMock request: wallet_sendCalls')) bundles++;
  });
  return () => bundles;
}

/** No deposit left Ethereum: no pending entry, no card, the USDS untouched. */
async function expectNothingSent(
  bridge: BridgePage,
  page: Page,
  account: Address,
  before: Awaited<ReturnType<typeof l1AccountState>>,
  { approves = 0 } = {}
) {
  expect(await pendingDepositTxHash(page, 'unichain')).toBeUndefined();
  await expect(bridge.cards()).toHaveCount(0);
  const after = await l1AccountState(account);
  expect(after.usds).toBe(before.usds);
  expect(after.nonce).toBe(before.nonce + approves);
}

/** Try again with the wallet working sends exactly one deposit of the reviewed amount. */
async function retryOnce(
  bridge: BridgePage,
  page: Page,
  account: Address,
  before: Awaited<ReturnType<typeof l1AccountState>>
) {
  await page.getByRole('dialog').getByRole('button', { name: 'Try again' }).click();
  await expectTransactionSuccess(page, { title: 'Bridge initiated!', timeout: 90_000 });
  await expect(bridge.cards()).toHaveCount(1, { timeout: 30_000 });
  await awaitDepositTxHash(page, 'unichain');
  expect((await l1AccountState(account)).usds).toBe(before.usds - parseUnits('1', 18));
}
