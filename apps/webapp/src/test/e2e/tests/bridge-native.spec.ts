import { type Page } from '@playwright/test';
import { parseUnits, type Address } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { L1_USDS } from '@/modules/bridge/adapters/nativeDeposit/contracts';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
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

    await bridge.openReview('5');
    await expect(isolatedPage.getByRole('dialog')).toContainText('Review USDS bridge');
    await expect(bridge.modalRow('Bridge type')).toContainText('Native');
    await expect(bridge.modalRow('Network fee')).toContainText(/\$\d/, { timeout: 30_000 });

    const bundles = countBundles(isolatedPage);
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    expect(bundles()).toBe(1);

    const card = bridge.card('Base');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending', { timeout: 30_000 });

    const txHash = await awaitDepositTxHash(isolatedPage, 'base');
    expect(await relayOpStackDeposit('base', txHash)).toContain('RelayedMessage');

    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Arrived', { timeout: 60_000 });
    await expect(bridge.cards()).toHaveCount(1);
    expect((await l2UsdsBalance('base', testAccount)) - before).toBe(parseUnits('5', 18));
  });

  test('OP Mainnet: a failed relay asks for a Replay that delivers the funds', async ({
    isolatedPage,
    testAccount
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');
    const before = await l2UsdsBalance('optimism', testAccount);

    await bridge.openReview('3');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });

    const txHash = await awaitDepositTxHash(isolatedPage, 'optimism');
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

    // Closed after the gate's last poll: only the read on Confirm can see it.
    const reopen = await closeOpStackBridge('unichain');
    try {
      await bridge.confirmButton().click();
      await expect(isolatedPage.getByRole('dialog')).toContainText('Transaction failed', { timeout: 60_000 });
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
    await isolatedPage.route(TENDERLY_RPC, route =>
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
    await isolatedPage.route(TENDERLY_RPC, route => {
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
    await bridge.openReview('1');

    let sends = 0;
    await isolatedPage.route(TENDERLY_RPC, route => {
      if (isSend(route.request().postData())) sends++;
      return route.fallback();
    });
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    await expect(bridge.cards()).toHaveCount(1, { timeout: 30_000 });
    expect(await pendingDepositTxHash(isolatedPage, 'unichain')).toBeTruthy();

    const after = await l1AccountState(testAccount);
    expect(after.usds).toBe(before.usds - parseUnits('1', 18));
    expect(sends).toBeGreaterThanOrEqual(1);
    expect(after.nonce).toBe(before.nonce + sends);
  });

  test('A bundle whose receipt never reached the tab keeps its card, and the deposit scan fills it after a reload', async ({
    isolatedPage
  }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('base');
    await bridge.openReview('2');

    // The wallet sends the bundle, but its status never comes back: the tab closes before the receipt.
    await isolatedPage.route(TENDERLY_RPC, route =>
      route.request().postData()?.includes('"eth_getTransactionReceipt"') ? undefined : route.fallback()
    );
    await bridge.confirmButton().click();
    const card = bridge.card('Base');
    await expect(card).toContainText('Confirming on Ethereum', { timeout: 60_000 });
    expect(await pendingDepositTxHash(isolatedPage, 'base')).toBeUndefined();

    await isolatedPage.unrouteAll({ behavior: 'ignoreErrors' });
    await bridge.gotoConnected();
    const txHash = await awaitDepositTxHash(isolatedPage, 'base');
    await expect(bridge.card('Base')).not.toContainText('Confirming on Ethereum');
    // The scan fills the bundle's card instead of adding a second one for its deposit.
    await expect(bridge.cards()).toHaveCount(1);
    expect(await relayOpStackDeposit('base', txHash)).toContain('RelayedMessage');
    await expect(bridge.card('Base').getByTestId('pending-bridge-status')).toHaveText('Arrived', {
      timeout: 60_000
    });
    await expect(bridge.cards()).toHaveCount(1);
  });
});

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';
const isSend = (body: string | null) => !!body?.includes('"eth_sendTransaction"');

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
  await page.unroute(TENDERLY_RPC);
  await page.getByRole('dialog').getByRole('button', { name: 'Try again' }).click();
  await expectTransactionSuccess(page, { title: 'Bridge initiated!', timeout: 90_000 });
  await expect(bridge.cards()).toHaveCount(1, { timeout: 30_000 });
  await awaitDepositTxHash(page, 'unichain');
  expect((await l1AccountState(account)).usds).toBe(before.usds - parseUnits('1', 18));
}
