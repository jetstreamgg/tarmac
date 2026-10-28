import { getAddress, parseUnits } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { NetworkName } from '../utils/constants';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { awaitDepositTxHash, l2UsdsBalance } from '../utils/bridgeRelay';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';

// L2 to Ethereum USDS through Sky's native bridge (APP-617), picked in Review. Separate vnets
// relay nothing, so the spec checks the L2 send and the card's first state; prove, finalize
// and execute are covered against forked mainnet withdrawals in the adapter tests.
const AMOUNT = parseUnits('5', 18);

const cases = [
  { network: NetworkName.base, id: 'base', footnote: 'You will need to come back to Ethereum twice' },
  { network: NetworkName.arbitrum, id: 'arbitrum', footnote: 'finalize it on Ethereum to receive your USDS' }
] as const;

test.describe('Bridge: L2 to Ethereum through SkyLink', () => {
  for (const { network, id, footnote } of cases) {
    test(`${id}: pick SkyLink in Review, confirm, and the card waits for the withdrawal`, async ({
      isolatedPage,
      testAccount
    }) => {
      const account = getAddress(testAccount);
      const bridge = new BridgePage(isolatedPage);
      await bridge.gotoConnected();
      await switchWalletNetwork(isolatedPage, tenderlyChainLabel(network));
      await bridge.expectBalanceLoaded();
      const before = await l2UsdsBalance(id, account);

      await bridge.openReview('5');
      await isolatedPage.getByTestId('bridge-modal-route-toggle').click();
      const picker = isolatedPage.getByTestId('bridge-route-picker');
      await expect(picker).toContainText('Select bridge type');
      const skyLink = isolatedPage.getByTestId('bridge-route-option-native');
      await expect(skyLink).toBeEnabled({ timeout: 30_000 });
      await skyLink.click();
      await expect(bridge.modalRow('Bridge type')).toContainText('SkyLink');
      await expect(isolatedPage.getByTestId('bridge-modal-footnote')).toContainText(footnote);

      await bridge.confirmButton().click();
      await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
      await expect
        .poll(async () => before - (await l2UsdsBalance(id, account)), { timeout: 30_000 })
        .toBe(AMOUNT);

      const card = bridge.card('Ethereum');
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending', { timeout: 60_000 });
      await expect(card).toContainText('SkyLink');
      expect(await awaitDepositTxHash(isolatedPage, 'ethereum')).toMatch(/^0x[0-9a-f]{64}$/);
    });
  }
});
