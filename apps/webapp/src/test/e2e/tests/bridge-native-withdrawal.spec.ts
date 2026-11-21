import { type Page } from '@playwright/test';
import { getAddress, parseUnits, type Address } from 'viem';
import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts';
import { ARBITRUM_CONFIRM_MS } from '@/modules/bridge/adapters/nativeWithdrawal/contracts';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import { NetworkName } from '../utils/constants';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import {
  confirmArbitrumWithdrawalOnFork,
  executeArbitrumWithdrawalOnFork
} from '../utils/arbitrumWithdrawalProof';
import { awaitDepositTxHash, l1AccountState, l2UsdsBalance } from '../utils/bridgeRelay';
import {
  finalizeOpStackWithdrawalOnFork,
  proveOpStackWithdrawalOnFork,
  setOpStackEscrowAllowance
} from '../utils/opStackWithdrawalProof';
import { keepPendingBridgesOnLoad } from '../utils/pendingBridgeStore';
import { shiftPageClock } from '../utils/shiftPageClock';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';

// L2 to Ethereum USDS through Sky's native bridge (APP-617), picked in Review. Separate vnets
// relay nothing: the finalize cases fake only the proof (OP Stack) or the confirmed send root
// (Arbitrum) on the Ethereum fork, so the card's Finalize runs the L1 contracts for real. Prove and execute calldata are
// pinned against mainnet transactions in the adapter tests.
const AMOUNT = parseUnits('5', 18);

const cases = [
  { network: NetworkName.base, id: 'base', footnote: 'You will need to come back to Ethereum twice' },
  { network: NetworkName.arbitrum, id: 'arbitrum', footnote: 'finalize it on Ethereum to receive your USDS' }
] as const;

/** Sends 5 USDS from `network` to Ethereum through SkyLink, picked in Review, to `recipient` if given; returns the L2 tx hash. */
async function withdrawThroughSkyLink(
  page: Page,
  bridge: BridgePage,
  { network, id, footnote }: (typeof cases)[number],
  account: Address,
  recipient?: Address
) {
  await bridge.gotoConnected();
  await switchWalletNetwork(page, tenderlyChainLabel(network));
  await bridge.expectBalanceLoaded();
  const before = await l2UsdsBalance(id, account);
  if (recipient) {
    await bridge.setRecipient(recipient);
    await bridge.recipientSave().click();
  }

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

  // The Replay case empties the Base escrow's allowance on the shared Ethereum fork for a while,
  // so a finalize running beside it would fail: these run one after the other.
  test.describe('base finalize', () => {
    test.describe.configure({ mode: 'default' });

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

    test('arbitrum: once the rollup confirms it, Finalize on the card releases the USDS on Ethereum', async ({
      isolatedPage,
      testAccount
    }) => {
      await keepPendingBridgesOnLoad(isolatedPage.context());
      const account = getAddress(testAccount);
      const bridge = new BridgePage(isolatedPage);
      const txHash = await withdrawThroughSkyLink(isolatedPage, bridge, cases[1], account);
      await confirmArbitrumWithdrawalOnFork(isolatedPage, txHash);
      const { usds: before } = await l1AccountState(account);
      // The card looks for the confirmed root only near its ETA, days away in real time.
      await shiftPageClock(isolatedPage, ARBITRUM_CONFIRM_MS);
      await bridge.gotoConnected();

      const card = bridge.card('Ethereum');
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Ready to finalize', {
        timeout: 90_000
      });
      await expect(card.getByTestId('pending-bridge-action')).toHaveText('Finalize');
      await card.getByTestId('pending-bridge-action').click();
      await expect
        .poll(async () => (await l1AccountState(account)).usds - before, { timeout: 90_000 })
        .toBe(AMOUNT);
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Claimed', { timeout: 90_000 });
    });

    test('base: a finalize whose release fails asks for a Replay, which releases the USDS', async ({
      isolatedPage,
      testAccount
    }) => {
      await keepPendingBridgesOnLoad(isolatedPage.context());
      const account = getAddress(testAccount);
      const bridge = new BridgePage(isolatedPage);
      const txHash = await withdrawThroughSkyLink(isolatedPage, bridge, cases[0], account);
      await proveOpStackWithdrawalOnFork('base', txHash, account);
      const { usds: before } = await l1AccountState(account);
      const allowance = await setOpStackEscrowAllowance('base', 0n);
      try {
        await bridge.gotoConnected();
        const card = bridge.card('Ethereum');
        const status = card.getByTestId('pending-bridge-status');
        const action = card.getByTestId('pending-bridge-action');
        await expect(status).toHaveText('Ready to finalize', { timeout: 90_000 });
        await action.click();
        await expect(status).toHaveText('Action needed', { timeout: 90_000 });
        await expect(action).toHaveText('Replay');
        expect((await l1AccountState(account)).usds).toBe(before);

        await setOpStackEscrowAllowance('base', allowance);
        await action.click();
        await expect
          .poll(async () => (await l1AccountState(account)).usds - before, { timeout: 90_000 })
          .toBe(AMOUNT);
        await expect(status).toHaveText('Claimed', { timeout: 90_000 });
      } finally {
        await setOpStackEscrowAllowance('base', allowance);
      }
    });

    test('base: a finalize another wallet sends reads Claimed, with nothing left to send', async ({
      isolatedPage,
      testAccount
    }) => {
      await keepPendingBridgesOnLoad(isolatedPage.context());
      const account = getAddress(testAccount);
      const bridge = new BridgePage(isolatedPage);
      const txHash = await withdrawThroughSkyLink(isolatedPage, bridge, cases[0], account);
      await proveOpStackWithdrawalOnFork('base', txHash, account);
      const before = await l1AccountState(account);
      await finalizeOpStackWithdrawalOnFork('base', txHash, account);
      await bridge.gotoConnected();

      const card = bridge.card('Ethereum');
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Claimed', { timeout: 90_000 });
      await expect(card.getByTestId('pending-bridge-action')).toHaveCount(0);
      expect(await l1AccountState(account)).toEqual({ nonce: before.nonce, usds: before.usds + AMOUNT });
    });

    test('arbitrum: an execute another wallet sends reads Claimed, with nothing left to send', async ({
      isolatedPage,
      testAccount
    }) => {
      await keepPendingBridgesOnLoad(isolatedPage.context());
      const account = getAddress(testAccount);
      const bridge = new BridgePage(isolatedPage);
      const txHash = await withdrawThroughSkyLink(isolatedPage, bridge, cases[1], account);
      const confirmed = await confirmArbitrumWithdrawalOnFork(isolatedPage, txHash);
      const before = await l1AccountState(account);
      await executeArbitrumWithdrawalOnFork(confirmed);
      await shiftPageClock(isolatedPage, ARBITRUM_CONFIRM_MS);
      await bridge.gotoConnected();

      const card = bridge.card('Ethereum');
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Claimed', { timeout: 90_000 });
      await expect(card.getByTestId('pending-bridge-action')).toHaveCount(0);
      expect(await l1AccountState(account)).toEqual({ nonce: before.nonce, usds: before.usds + AMOUNT });
    });

    test('base: with storage cleared once proven, the scan finds the withdrawal and Finalize releases the USDS', async ({
      isolatedPage,
      testAccount
    }) => {
      const account = getAddress(testAccount);
      const bridge = new BridgePage(isolatedPage);
      const txHash = await withdrawThroughSkyLink(isolatedPage, bridge, cases[0], account);
      await proveOpStackWithdrawalOnFork('base', txHash, account);
      const { usds: before } = await l1AccountState(account);
      // A mock load clears localStorage, as another browser or cleared site data would.
      await bridge.gotoConnected();

      const card = bridge.card('Ethereum');
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Ready to finalize', {
        timeout: 120_000
      });
      await card.getByTestId('pending-bridge-action').click();
      await expect
        .poll(async () => (await l1AccountState(account)).usds - before, { timeout: 90_000 })
        .toBe(AMOUNT);
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Claimed', { timeout: 90_000 });
    });

    test('base: to another wallet, the sender finalizes and the USDS reach that wallet only', async ({
      isolatedPage,
      testAccount
    }) => {
      await keepPendingBridgesOnLoad(isolatedPage.context());
      const account = getAddress(testAccount);
      const recipient = privateKeyToAddress(generatePrivateKey());
      const bridge = new BridgePage(isolatedPage);
      const txHash = await withdrawThroughSkyLink(isolatedPage, bridge, cases[0], account, recipient);
      const card = bridge.card('Ethereum');
      await expect(card).toContainText('Destination wallet');
      await proveOpStackWithdrawalOnFork('base', txHash, account);
      const { usds: senderBefore } = await l1AccountState(account);
      const { usds: recipientBefore } = await l1AccountState(recipient);
      await bridge.gotoConnected();

      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Ready to finalize', {
        timeout: 90_000
      });
      await card.getByTestId('pending-bridge-action').click();
      await expect
        .poll(async () => (await l1AccountState(recipient)).usds - recipientBefore, { timeout: 90_000 })
        .toBe(AMOUNT);
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Claimed', { timeout: 90_000 });
      expect((await l1AccountState(account)).usds).toBe(senderBefore);
    });
  });
});
