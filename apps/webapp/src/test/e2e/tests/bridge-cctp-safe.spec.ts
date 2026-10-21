import { type BrowserContext, type Page } from '@playwright/test';
import { getAddress, isAddressEqual, parseUnits, type Address, type Hex } from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import {
  L1_USDC,
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  USDS_PSM_WRAPPER,
  cctpL2Contracts
} from '@/modules/bridge/adapters/cctp/contracts';
import { NetworkName } from '../utils/constants';
import { deploySafe, enableSafeMode, type MockSafeController } from '../utils/mockSafe';
import { setErc20Balance } from '../utils/setBalance';
import { awaitDepositTxHash, l1AccountState } from '../utils/bridgeRelay';
import { stubIris } from '../utils/cctpAttester';

// APP-614: CCTP from a real Safe on Base, as a Safe App. A Safe sends every leg as its own
// Safe tx and keeps no swap to continue, since the chain can't confirm a swap by a safeTxHash.

const AMOUNT = '2';
const DELIVERED = parseUnits(AMOUNT, 18);
const BASE = cctpL2Contracts('base');

/** A fresh 1-of-1 Safe owned by the test account, deployed on `networks` and funded with USDS on Base. */
async function freshSafe(owner: Address, networks: NetworkName[]) {
  const owners = [owner];
  const safe = await deploySafe({ owners, saltNonce: BigInt(Date.now()), networks });
  await setErc20Balance(BASE.usds, '5', 18, NetworkName.base, safe);
  return { safe, owners };
}

/** Executes the next queued Safe tx after checking it calls `to`, and returns its on-chain hash. */
async function executeNext(safeMode: MockSafeController, to: Address) {
  const tx = await safeMode.waitForQueued({ timeout: 60_000 });
  expect(tx.operation).toBe(0);
  expect(isAddressEqual(tx.to, to)).toBe(true);
  return (await safeMode.execute(tx.safeTxHash)).execution!.transactionHash;
}

const SWAP_PREFIX = 'bridgeCctpSwap:v1:';

/** Mock builds clear localStorage on every load (config.e2e.ts); this keeps the pending bridges and kept swaps, as a real reload does. */
const keepBridgeStorageOnLoad = (context: BrowserContext) =>
  context.addInitScript(
    prefixes => {
      Storage.prototype.clear = function (this: Storage) {
        for (const key of Object.keys(this))
          if (!prefixes.some(prefix => key.startsWith(prefix))) this.removeItem(key);
      };
    },
    ['bridgePending:v1:', SWAP_PREFIX]
  );

const keptSwaps = (page: Page) =>
  page.evaluate(
    prefix =>
      Object.keys(localStorage)
        .filter(key => key.startsWith(prefix))
        .flatMap(key => JSON.parse(localStorage.getItem(key) ?? '[]') as unknown[]),
    SWAP_PREFIX
  );

/** The Safe on Base with the form on Base to Ethereum and the review open, its notes checked and accepted. */
async function openReviewAsSafe(page: Page) {
  const bridge = new BridgePage(page);
  await bridge.gotoAsSafe();
  // The dapp must not switch a Safe: the source is a static badge.
  await expect(bridge.fromNetwork()).toHaveJSProperty('tagName', 'SPAN');
  await expect(bridge.toNetwork()).toContainText('Ethereum');
  await bridge.openReview(AMOUNT);
  await expect(bridge.modalRow('Bridge type')).toContainText('CCTP');
  await expect(page.getByTestId('bridge-modal-safe-queue')).toContainText(
    "Sign and execute every one of them in your Safe's queue."
  );
  // A Safe is a contract wallet: Confirm waits until it says it controls its address on Ethereum.
  const contractWallet = page.getByTestId('bridge-modal-contract-wallet');
  await expect(contractWallet).toContainText('smart contract wallet');
  await expect(bridge.confirmButton()).toBeDisabled();
  await contractWallet.getByText(/I control this address on Ethereum/).click();
  await expect(bridge.confirmButton()).toBeEnabled({ timeout: 30_000 });
  return bridge;
}

const status = (bridge: BridgePage) => bridge.card('Ethereum').getByTestId('pending-bridge-status');

test.describe('Bridge: CCTP from a Safe', () => {
  test('A Safe on Base queues each leg on its own, and claims the USDS on Ethereum once switched there', async ({
    isolatedPage,
    testAccount
  }) => {
    const networks = [NetworkName.mainnet, NetworkName.base];
    const { safe, owners } = await freshSafe(testAccount, networks);
    await keepBridgeStorageOnLoad(isolatedPage.context());
    const iris = await stubIris(isolatedPage);
    const safeMode = await enableSafeMode(isolatedPage, {
      safe,
      owners,
      network: NetworkName.base,
      networks
    });
    const { usds: before } = await l1AccountState(safe);
    const bridge = await openReviewAsSafe(isolatedPage);
    await bridge.confirmButton().click();

    await executeNext(safeMode, BASE.usds);
    await executeNext(safeMode, BASE.psm3);
    // The swap is never kept for a Safe, though it executed.
    expect(await keptSwaps(isolatedPage)).toEqual([]);
    await executeNext(safeMode, BASE.usdc);
    const burn = await safeMode.waitForQueued({ timeout: 60_000 });
    expect(isAddressEqual(burn.to, TOKEN_MESSENGER_V2)).toBe(true);
    await expect(bridge.card('Ethereum')).toContainText('Awaiting signatures', { timeout: 30_000 });
    const txHash = (await safeMode.execute(burn.safeTxHash)).execution!.transactionHash;

    // The card follows the burn by its on-chain hash, not the safeTxHash.
    await expect.poll(() => awaitDepositTxHash(isolatedPage, 'ethereum'), { timeout: 60_000 }).toBe(txHash);
    await expect(status(bridge)).toHaveText('Pending', { timeout: 60_000 });
    expect(await keptSwaps(isolatedPage)).toEqual([]);
    await iris.attest(NetworkName.base, txHash);
    await expect(status(bridge)).toHaveText('Ready to claim', { timeout: 90_000 });
    // The app can't switch a Safe: the card asks for it.
    await expect(bridge.card('Ethereum')).toContainText('Switch your Safe to Ethereum to continue.');

    await safeMode.switchNetwork(NetworkName.mainnet);
    await expect(isolatedPage.getByTestId('wallet-chip')).toContainText('safe:0x', { timeout: 15_000 });
    await expect(status(bridge)).toHaveText('Ready to claim', { timeout: 90_000 });
    await bridge.card('Ethereum').getByTestId('pending-bridge-action').click();
    await executeNext(safeMode, MESSAGE_TRANSMITTER_V2);
    await executeNext(safeMode, L1_USDC);
    await executeNext(safeMode, USDS_PSM_WRAPPER);
    await expect
      .poll(async () => (await l1AccountState(safe)).usds - before, { timeout: 30_000 })
      .toBe(DELIVERED);
    await expect(status(bridge)).toHaveText('Claimed', { timeout: 60_000 });
    expect(safeMode.queued()).toEqual([]);
    expect(safeMode.unmockedRequests).toEqual([]);
  });

  test('A Safe whose burn is still queued after a reload gets no Continue card, and the card follows the burn once it executes', async ({
    isolatedPage,
    testAccount
  }) => {
    const networks = [NetworkName.mainnet, NetworkName.base];
    const { safe, owners } = await freshSafe(testAccount, networks);
    await keepBridgeStorageOnLoad(isolatedPage.context());
    const safeMode = await enableSafeMode(isolatedPage, {
      safe,
      owners,
      network: NetworkName.base,
      networks
    });
    const bridge = await openReviewAsSafe(isolatedPage);
    await bridge.confirmButton().click();

    await executeNext(safeMode, BASE.usds);
    await executeNext(safeMode, BASE.psm3);
    await executeNext(safeMode, BASE.usdc);
    const burn = await safeMode.waitForQueued({ timeout: 60_000 });
    expect(isAddressEqual(burn.to, TOKEN_MESSENGER_V2)).toBe(true);

    // The app is closed with the burn unsigned: the queue, not a Continue card, finishes it.
    await isolatedPage.reload();
    await expect(isolatedPage.getByTestId('wallet-chip')).toContainText('safe:0x', { timeout: 15_000 });
    await expect(bridge.card('Ethereum')).toContainText('Awaiting signatures', { timeout: 30_000 });
    await expect(isolatedPage.getByTestId('continue-bridge-card')).toHaveCount(0);
    expect(await keptSwaps(isolatedPage)).toEqual([]);

    const txHash: Hex = (await safeMode.execute(burn.safeTxHash)).execution!.transactionHash;
    await expect.poll(() => awaitDepositTxHash(isolatedPage, 'ethereum'), { timeout: 90_000 }).toBe(txHash);
    await expect(status(bridge)).toHaveText('Pending', { timeout: 60_000 });
    await expect(isolatedPage.getByTestId('continue-bridge-card')).toHaveCount(0);
    expect(safeMode.unmockedRequests).toEqual([]);
  });

  test('A Safe missing on Ethereum needs a recipient, who is warned to claim there', async ({
    isolatedPage,
    testAccount
  }) => {
    const { safe, owners } = await freshSafe(testAccount, [NetworkName.base]);
    const safeMode = await enableSafeMode(isolatedPage, {
      safe,
      owners,
      network: NetworkName.base,
      networks: [NetworkName.base]
    });
    const bridge = new BridgePage(isolatedPage);
    await bridge.gotoAsSafe();
    await expect(bridge.toNetwork()).toContainText('Ethereum');

    await bridge.fromAmount().fill(AMOUNT);
    await expect(bridge.recipientHint()).toHaveText(/Your Safe is not deployed on the destination network/, {
      timeout: 30_000
    });
    await expect(bridge.reviewCta()).toBeDisabled();

    await bridge.setRecipient(getAddress(testAccount));
    await bridge.recipientSave().click();
    await expect(bridge.recipientHint()).toHaveCount(0);
    await expect(bridge.reviewCta()).toBeEnabled({ timeout: 30_000 });
    await bridge.reviewCta().click();
    await expect(bridge.modalReview()).toBeVisible();
    await expect(isolatedPage.getByTestId('bridge-modal-recipient-warning')).toContainText(
      "won't see this transfer automatically"
    );
    await expect(isolatedPage.getByTestId('bridge-modal-safe-queue')).toBeVisible();
    // The recipient claims, not the Safe: no contract wallet box.
    await expect(isolatedPage.getByTestId('bridge-modal-contract-wallet')).toHaveCount(0);
    await expect(bridge.confirmButton()).toBeEnabled({ timeout: 30_000 });
    expect(safeMode.queued()).toEqual([]);
    expect(safeMode.unmockedRequests).toEqual([]);
  });
});
