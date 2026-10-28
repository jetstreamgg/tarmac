import { type Page } from '@playwright/test';
import { getAddress, parseUnits, type Address } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { NetworkName } from '../utils/constants';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { awaitDepositTxHash, l1AccountState, l2UsdsBalance } from '../utils/bridgeRelay';
import { proveOpStackWithdrawalOnFork } from '../utils/opStackWithdrawalProof';
import { keepPendingBridgesOnLoad } from '../utils/pendingBridgeStore';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';

// L2 to Ethereum USDS through Sky's native bridge (APP-617), picked in Review. Separate vnets
// relay nothing: the finalize case fakes only the proof on the Ethereum fork, so the card's
// Finalize runs portal, messenger, bridge and escrow for real. Prove and execute calldata are
// pinned against mainnet transactions in the adapter tests.
const AMOUNT = parseUnits('5', 18);

const cases = [
  { network: NetworkName.base, id: 'base', footnote: 'You will need to come back to Ethereum twice' },
  { network: NetworkName.arbitrum, id: 'arbitrum', footnote: 'finalize it on Ethereum to receive your USDS' }
] as const;

/** Sends 5 USDS from `network` to Ethereum through SkyLink, picked in Review; returns the L2 tx hash. */
async function withdrawThroughSkyLink(
  page: Page,
  bridge: BridgePage,
  { network, id, footnote }: (typeof cases)[number],
  account: Address
) {
  await bridge.gotoConnected();
  await switchWalletNetwork(page, tenderlyChainLabel(network));
  await bridge.expectBalanceLoaded();
  const before = await l2UsdsBalance(id, account);

  await bridge.openReview('5');
  await page.getByTestId('bridge-modal-route-toggle').click();
  await expect(page.getByTestId('bridge-route-picker')).toContainText('Select bridge type');
  const skyLink = page.getByTestId('bridge-route-option-native');
  await expect(skyLink).toBeEnabled({ timeout: 30_000 });
  await skyLink.click();
  await expect(bridge.modalRow('Bridge type')).toContainText('SkyLink');
  await expect(page.getByTestId('bridge-modal-footnote')).toContainText(footnote);

  await bridge.confirmButton().click();
  await expectTransactionSuccess(page, { title: 'Bridge initiated!', timeout: 90_000 });
  await expect
    .poll(async () => before - (await l2UsdsBalance(id, account)), { timeout: 30_000 })
    .toBe(AMOUNT);
  return awaitDepositTxHash(page, 'ethereum');
}

test.describe('Bridge: L2 to Ethereum through SkyLink', () => {
  for (const withdrawal of cases) {
    test(`${withdrawal.id}: pick SkyLink in Review, confirm, and the card waits for the withdrawal`, async ({
      isolatedPage,
      testAccount
    }) => {
      const bridge = new BridgePage(isolatedPage);
      const txHash = await withdrawThroughSkyLink(isolatedPage, bridge, withdrawal, getAddress(testAccount));
      expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
      const card = bridge.card('Ethereum');
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending', { timeout: 60_000 });
      await expect(card).toContainText('SkyLink');
    });
  }

  test('base: once proven, Finalize on the card releases the USDS on Ethereum', async ({
    isolatedPage,
    testAccount
  }) => {
    await keepPendingBridgesOnLoad(isolatedPage.context());
    const account = getAddress(testAccount);
    const bridge = new BridgePage(isolatedPage);
    const txHash = await withdrawThroughSkyLink(isolatedPage, bridge, cases[0], account);
    await proveOpStackWithdrawalOnFork('base', txHash, account);
    const { usds: before } = await l1AccountState(account);
    // Days from its ETA, the card reads every 5 minutes; a load reads it at once.
    await bridge.gotoConnected();

    const card = bridge.card('Ethereum');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Ready to finalize', {
      timeout: 90_000
    });
    await card.getByTestId('pending-bridge-action').click();
    await expect
      .poll(async () => (await l1AccountState(account)).usds - before, { timeout: 90_000 })
      .toBe(AMOUNT);
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Claimed', { timeout: 90_000 });
  });
});
