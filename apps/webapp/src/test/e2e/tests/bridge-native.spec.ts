import { parseUnits } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import {
  closeOpStackBridge,
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

    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });

    const card = bridge.card('Base');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending', { timeout: 30_000 });

    const txHash = await pendingDepositTxHash(isolatedPage, 'base');
    expect(txHash).toBeTruthy();
    expect(await relayOpStackDeposit('base', txHash!)).toContain('RelayedMessage');

    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Arrived', { timeout: 60_000 });
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

    const txHash = await pendingDepositTxHash(isolatedPage, 'optimism');
    expect(txHash).toBeTruthy();
    // Too little gas for the token bridge's mint: the messenger records the message as failed.
    expect(await relayOpStackDeposit('optimism', txHash!, { gas: 150_000n })).toContain(
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

  test('A rejected bridge leaves nothing pending', async ({ isolatedPage }) => {
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('unichain');
    await bridge.openReview('1');

    await isolatedPage.route('https://virtual.**.rpc.tenderly.co/**', route =>
      route.request().postData()?.includes('eth_sendTransaction') ? route.abort() : route.fallback()
    );
    await bridge.confirmButton().click();

    await expect(isolatedPage.getByRole('dialog')).toContainText(/failed|rejected|error/i, {
      timeout: 60_000
    });
    expect(await pendingDepositTxHash(isolatedPage, 'unichain')).toBeUndefined();
    await expect(bridge.cards()).toHaveCount(0);
  });
});
