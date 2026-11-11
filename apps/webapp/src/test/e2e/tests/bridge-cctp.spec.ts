import { parseUnits } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { NetworkName } from '../utils/constants';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { awaitDepositTxHash, l1AccountState, l2UsdsBalance } from '../utils/bridgeRelay';
import { stubIris } from '../utils/cctpAttester';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';

// L2 to Ethereum USDS through CCTP (APP-614). Circle never attests fork burns, so the
// spec signs the attested message with the test attester the global setup enables,
// and serves it from a stubbed Iris.
test.describe('Bridge: L2 to Ethereum through CCTP', () => {
  test('Base: review, confirm, then the card offers a Claim that delivers USDS on Ethereum', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await switchWalletNetwork(isolatedPage, tenderlyChainLabel(NetworkName.base));
    await bridge.expectBalanceLoaded();
    await expect(bridge.toNetwork()).toContainText('Ethereum');
    const { usds: before } = await l1AccountState(testAccount);

    await bridge.openReview('5');
    await expect(isolatedPage.getByRole('dialog')).toContainText('Review USDS bridge');
    await expect(bridge.modalRow('Bridge type')).toContainText('CCTP');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });

    const card = bridge.card('Ethereum');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending', { timeout: 30_000 });

    const txHash = await awaitDepositTxHash(isolatedPage, 'ethereum');
    await iris.attest(NetworkName.base, txHash);
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Ready to claim', {
      timeout: 90_000
    });
    const claim = card.getByTestId('pending-bridge-action');
    await expect(claim).toHaveText('Claim');

    // The claim runs on Ethereum: the card switches the wallet there itself.
    await claim.click();
    await expectTransactionSuccess(isolatedPage, { title: 'Funds claimed successfully!', timeout: 90_000 });
    await expect
      .poll(async () => (await l1AccountState(testAccount)).usds - before, { timeout: 30_000 })
      .toBe(parseUnits('5', 18));
    // Once the USDS is delivered the card closes; the bridge stays in Activity.
    await expect(card).toHaveCount(0, { timeout: 60_000 });
  });
  test('Base: past the 6 decimals of USDC, only the first 6 are bridged and the rest stays in the wallet', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await switchWalletNetwork(isolatedPage, tenderlyChainLabel(NetworkName.base));
    await bridge.expectBalanceLoaded();
    const sent = parseUnits('1.234567', 18);
    const { usds: before } = await l1AccountState(testAccount);
    const l2Before = await l2UsdsBalance('base', testAccount);

    await bridge.openReview('1.2345678');
    await expect(bridge.modalRow('Bridge type')).toContainText('CCTP');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    // The 0.0000008 USDS below one USDC unit is never swapped.
    await expect
      .poll(async () => l2Before - (await l2UsdsBalance('base', testAccount)), { timeout: 30_000 })
      .toBe(sent);

    await iris.attest(NetworkName.base, await awaitDepositTxHash(isolatedPage, 'ethereum'));
    const card = bridge.card('Ethereum');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Ready to claim', {
      timeout: 90_000
    });
    await card.getByTestId('pending-bridge-action').click();
    await expectTransactionSuccess(isolatedPage, { title: 'Funds claimed successfully!', timeout: 90_000 });
    await expect
      .poll(async () => (await l1AccountState(testAccount)).usds - before, { timeout: 30_000 })
      .toBe(sent);
  });
});
