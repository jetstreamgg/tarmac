import { type Page } from '@playwright/test';
import { getAddress, parseUnits } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { MOBILE_VIEWPORT, ShellPage } from '../pages/ShellPage';
import { chainId } from '@/utils/chainId';
import { getEtherscanLink } from '@/utils/getEtherscanLink';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { watchDeposit } from '../utils/bridgeFunds';
import { awaitDepositTxHash, relayOpStackDeposit } from '../utils/bridgeRelay';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';
import { NetworkName } from '../utils/constants';

// APP-643 activity, links and mobile, on OP Mainnet: no other spec closes that bridge.
// The source runs on the Ethereum fork, so its links open the fork's explorer; destination
// links use the L2's own explorer, where fork transactions don't exist.

/** The hash of the newest destination action sent for the newest bridge to `to`. */
const actionTxHash = (page: Page, to: string) =>
  page.evaluate(destination => {
    const entries = Object.keys(localStorage)
      .filter(key => key.startsWith('bridgePending:v1:') && !key.endsWith(':unreadable'))
      .flatMap(
        key =>
          JSON.parse(localStorage.getItem(key) ?? '[]') as {
            to: string;
            startedAt: number;
            actions: { txHash: string; at: number }[];
          }[]
      )
      .filter(entry => entry.to === destination)
      .sort((a, b) => b.startedAt - a.startedAt);
    return entries[0]?.actions.at(-1)?.txHash;
  }, to);

/** The open modal is the bottom sheet, flush with the viewport's bottom edge. */
async function expectBottomSheet(page: Page) {
  const sheet = page.locator('[data-slot="sheet-content"]');
  await expect(sheet).toBeVisible();
  // Polled: the sheet slides up from below the viewport.
  await expect
    .poll(async () => {
      const box = (await sheet.boundingBox())!;
      return [Math.round(box.y + box.height), box.width <= MOBILE_VIEWPORT.width];
    })
    .toEqual([MOBILE_VIEWPORT.height, true]);
}

const expectNoHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    MOBILE_VIEWPORT.width
  );

/** Deposits `amount` to OP Mainnet and relays it with too little gas, so the card asks for a Replay. */
async function depositNeedingReplay(page: Page, account: `0x${string}`, amount: string) {
  const bridge = new BridgePage(page);
  await bridge.gotoConnected();
  await bridge.selectDestination('optimism');
  const funds = await watchDeposit({ to: 'optimism', sender: account });
  await bridge.openReview(amount);
  await bridge.confirmButton().click();
  await expectTransactionSuccess(page, { title: 'Bridge initiated!', timeout: 90_000 });
  const txHash = await awaitDepositTxHash(page, 'optimism');
  await funds.expectEscrowed(txHash, parseUnits(amount, 18));
  expect(await relayOpStackDeposit('optimism', txHash, { gas: 150_000n })).toContain('FailedRelayedMessage');
  const card = bridge.card('OP Mainnet');
  await expect(card.getByTestId('pending-bridge-status')).toHaveText('Action needed', { timeout: 90_000 });
  return { bridge, card, funds, txHash };
}

test.describe('Bridge: activity and links', () => {
  test('Activity lists the bridge and its replay, each linking to its own chain', async ({
    isolatedPage,
    testAccount
  }) => {
    const { card, funds, txHash } = await depositNeedingReplay(isolatedPage, testAccount, '1');
    const sourceHref = getEtherscanLink(chainId.tenderly, txHash, 'tx');
    await expect(card.getByRole('link', { name: /0x/ })).toHaveAttribute('href', sourceHref);

    await card.getByTestId('pending-bridge-action').click();
    await expectTransactionSuccess(isolatedPage, { title: 'Replay sent!', timeout: 90_000 });
    await funds.expectArrived(parseUnits('1', 18));
    const replayHash = await actionTxHash(isolatedPage, 'optimism');
    expect(replayHash).toBeTruthy();

    // The replay leaves the wallet on OP; the Ethereum fork's scope holds the history.
    await switchWalletNetwork(isolatedPage, tenderlyChainLabel(NetworkName.mainnet));
    await new ShellPage(isolatedPage).openWalletDrawer();
    await isolatedPage.getByTestId('wallet-drawer-tab-activity').click();
    const bridgeRow = isolatedPage.getByTestId('bridge-activity-item-bridge');
    const replayRow = isolatedPage.getByTestId('bridge-activity-item-replay');
    await expect(bridgeRow).toHaveCount(1, { timeout: 30_000 });
    await expect(bridgeRow).toContainText('Bridge');
    await expect(bridgeRow).toContainText('1.00');
    await expect(bridgeRow).toHaveAttribute('href', sourceHref);
    await expect(replayRow).toHaveCount(1);
    await expect(replayRow).toContainText('Deposit replay');
    await expect(replayRow).toHaveAttribute('href', getEtherscanLink(chainId.optimism, replayHash!, 'tx'));
  });

  // The activity rows carry a title, a time and an amount, but no status: an expired or
  // undelivered bridge reads the same as an arrived one. Needs a product decision first.
  test.fixme('Completed, failed and expired bridges show their status in the activity list', async () => {});
});

test.describe('Bridge: mobile', () => {
  test.beforeEach(async ({ isolatedPage }) => {
    const shell = new ShellPage(isolatedPage);
    await shell.setMobileViewport();
    await shell.suppressNavBlockers();
  });

  test('A deposit at the mobile viewport: recipient and review as sheets, the card fits, the funds arrive', async ({
    isolatedPage,
    testAccount
  }) => {
    const account = getAddress(testAccount);
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoConnected();
    await bridge.selectDestination('optimism');
    await expectNoHorizontalScroll(isolatedPage);

    await bridge.recipientButton().click();
    await expectBottomSheet(isolatedPage);
    await isolatedPage.getByTestId('bridge-recipient-close').click();
    await expect(isolatedPage.locator('[data-slot="sheet-content"]')).toHaveCount(0);

    const funds = await watchDeposit({ to: 'optimism', sender: account });
    await bridge.openReview('2');
    await expectBottomSheet(isolatedPage);
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });

    const txHash = await awaitDepositTxHash(isolatedPage, 'optimism');
    await funds.expectEscrowed(txHash, parseUnits('2', 18));
    expect(await relayOpStackDeposit('optimism', txHash)).toContain('RelayedMessage');
    const card = bridge.card('OP Mainnet');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Arrived', { timeout: 60_000 });
    const box = (await card.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    await expectNoHorizontalScroll(isolatedPage);
    await funds.expectArrived(parseUnits('2', 18));
  });

  test('A replay at the mobile viewport runs in a bottom sheet and delivers the funds', async ({
    isolatedPage,
    testAccount
  }) => {
    const { card, funds } = await depositNeedingReplay(isolatedPage, testAccount, '1');
    await expect(card.getByTestId('pending-bridge-note')).toBeVisible();
    await expectNoHorizontalScroll(isolatedPage);

    await card.getByTestId('pending-bridge-action').click();
    await expectBottomSheet(isolatedPage);
    await expectTransactionSuccess(isolatedPage, { title: 'Replay sent!', timeout: 90_000 });
    await funds.expectArrived(parseUnits('1', 18));
  });
});
