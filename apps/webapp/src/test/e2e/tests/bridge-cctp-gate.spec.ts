import { type Page, type Route } from '@playwright/test';
import {
  decodeFunctionResult,
  encodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  getAddress,
  parseAbi,
  parseUnits,
  type Address
} from 'viem';
import { expect, test } from '../fixtures-parallel';
import { BridgePage } from '../pages/BridgePage';
import {
  MESSAGE_TRANSMITTER_V2,
  TOKEN_MESSENGER_V2,
  USDS_PSM_WRAPPER,
  cctpL2Contracts
} from '@/modules/bridge/adapters/cctp/contracts';
import { l2BridgeGateAbi, l2WithdrawalBridge } from '@/modules/bridge/adapters/nativeWithdrawal/contracts';
import { NetworkName } from '../utils/constants';
import { getRpcUrlFromFile } from '../utils/getRpcUrlFromFile';
import { expectTransactionSuccess } from '../utils/expectTransactionSuccess';
import { awaitDepositTxHash, l1AccountState, l2UsdsBalance } from '../utils/bridgeRelay';
import { stubIris } from '../utils/cctpAttester';
import { stubForkCalls, type CallAnswer } from '../utils/forkCallStub';
import { rpcAt, same } from '../utils/rpcShim';
import { switchWalletNetwork, tenderlyChainLabel } from '../utils/switchWalletNetwork';

// APP-646: CCTP's gate from Base to Ethereum, read short or closed for this page only (the
// forks are shared by every worker), so the route falls back, blocks or refuses before a send.

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';
const AMOUNT = '2';
const BASE = cctpL2Contracts('base');
const SKYLINK = l2WithdrawalBridge('base').bridge;
const POCKET_ABI = parseAbi(['function pocket() view returns (address)']);
const WRAPPER_TIN_ABI = parseAbi(['function tin() view returns (uint256)']);

/** Where PSM3 on the Base fork keeps the USDC it swaps out. */
async function psm3Pocket(): Promise<Address> {
  const rpc = rpcAt(await getRpcUrlFromFile(NetworkName.base));
  const data = await rpc('eth_call', [
    { to: BASE.psm3, data: encodeFunctionData({ abi: POCKET_ABI, functionName: 'pocket' }) },
    'latest'
  ]);
  return decodeFunctionResult({ abi: POCKET_ABI, functionName: 'pocket', data });
}

/** Base's gate as this page reads it: PSM3's USDC while `pocketUsdc()` gives one, SkyLink closed while `skyLinkClosed()`. */
const baseGate =
  (
    pocket: Address,
    {
      pocketUsdc = () => undefined,
      skyLinkClosed = () => false
    }: {
      pocketUsdc?: () => bigint | undefined;
      skyLinkClosed?: () => boolean;
    }
  ): CallAnswer =>
  (target, callData) => {
    const usdc = pocketUsdc();
    if (
      usdc !== undefined &&
      same(target, BASE.usdc) &&
      same(callData, encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [pocket] }))
    )
      return encodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', result: usdc });
    if (
      skyLinkClosed() &&
      same(target, SKYLINK) &&
      same(callData, encodeFunctionData({ abi: l2BridgeGateAbi, functionName: 'isOpen' }))
    )
      return encodeFunctionResult({ abi: l2BridgeGateAbi, functionName: 'isOpen', result: 0n });
    return undefined;
  };

/** Every address the wallet sends to from this page, in order. */
async function recordSends(page: Page) {
  const sent: Address[] = [];
  await page.route(TENDERLY_RPC, (route: Route) => {
    const body = route.request().postData();
    if (body?.includes('"eth_sendTransaction"')) sent.push(getAddress(JSON.parse(body).params[0].to));
    return route.fallback();
  });
  return sent;
}

/** The wallet on Base with the form on Base to Ethereum. */
async function openOnBase(page: Page) {
  const bridge = new BridgePage(page);
  await bridge.gotoConnected();
  await switchWalletNetwork(page, tenderlyChainLabel(NetworkName.base));
  await bridge.expectBalanceLoaded();
  await expect(bridge.toNetwork()).toContainText('Ethereum');
  return bridge;
}

test.describe('Bridge: CCTP gate from Base to Ethereum', () => {
  test('Without the USDC on PSM3, Review opens on SkyLink with its notice, and Confirm sends the native withdrawal', async ({
    isolatedPage,
    testAccount
  }) => {
    await stubForkCalls(
      isolatedPage,
      NetworkName.base,
      baseGate(await psm3Pocket(), { pocketUsdc: () => 0n })
    );
    const bridge = await openOnBase(isolatedPage);
    const sent = await recordSends(isolatedPage);
    const before = await l2UsdsBalance('base', testAccount);

    await bridge.openReview(AMOUNT);
    await expect(bridge.modalRow('Bridge type')).toContainText('SkyLink');
    await expect(isolatedPage.getByText('CCTP route unavailable')).toBeVisible();
    await expect(
      isolatedPage.getByText('Not enough USDC liquidity on Base for CCTP.', { exact: false })
    ).toBeVisible();
    // CCTP stays listed, greyed with its reason.
    await isolatedPage.getByTestId('bridge-modal-route-toggle').click();
    const cctp = isolatedPage.getByTestId('bridge-route-option-cctp');
    await expect(cctp).toBeDisabled();
    await expect(cctp).toContainText('Insufficient liquidity');
    await isolatedPage.getByTestId('bridge-route-picker-back').click();
    await expect(bridge.modalRow('Bridge type')).toContainText('SkyLink');
    expect(sent).toEqual([]);

    // Nothing goes until the user confirms the SkyLink Review.
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    expect(sent.at(-1)).toBe(getAddress(SKYLINK));
    expect(sent).not.toContain(getAddress(BASE.psm3));
    expect(sent).not.toContain(getAddress(TOKEN_MESSENGER_V2));
    await expect
      .poll(async () => before - (await l2UsdsBalance('base', testAccount)), { timeout: 30_000 })
      .toBe(parseUnits(AMOUNT, 18));
  });

  test('Without the USDC on PSM3 and with SkyLink closed, Review is blocked', async ({ isolatedPage }) => {
    await stubForkCalls(
      isolatedPage,
      NetworkName.base,
      baseGate(await psm3Pocket(), { pocketUsdc: () => 0n, skyLinkClosed: () => true })
    );
    const bridge = await openOnBase(isolatedPage);
    await bridge.fromAmount().fill(AMOUNT);
    await expect(bridge.blocked()).toHaveText(
      'Bridging from Base to Ethereum is unavailable right now. Try again later.',
      { timeout: 60_000 }
    );
    await expect(bridge.reviewCta()).toBeDisabled();
  });

  test('PSM3 liquidity that drops after Review is read again at Confirm, and nothing is sent', async ({
    isolatedPage,
    testAccount
  }) => {
    let drained = false;
    await stubForkCalls(
      isolatedPage,
      NetworkName.base,
      baseGate(await psm3Pocket(), { pocketUsdc: () => (drained ? 0n : undefined) })
    );
    const bridge = await openOnBase(isolatedPage);
    const sent = await recordSends(isolatedPage);
    const before = await l2UsdsBalance('base', testAccount);
    await bridge.openReview(AMOUNT);
    await expect(bridge.modalRow('Bridge type')).toContainText('CCTP');

    drained = true;
    await bridge.confirmButton().click();
    await expect(isolatedPage.getByRole('dialog')).toContainText(
      'There is not enough liquidity to bridge this amount.',
      { timeout: 60_000 }
    );
    expect(sent).toEqual([]);
    expect(await l2UsdsBalance('base', testAccount)).toBe(before);
    await expect(bridge.cards()).toHaveCount(0);
  });

  test('A claim while the swap back to USDS is paused is refused, and claims once it reopens', async ({
    isolatedPage,
    testAccount
  }) => {
    const iris = await stubIris(isolatedPage);
    const bridge = await openOnBase(isolatedPage);
    const { usds: before } = await l1AccountState(testAccount);
    await bridge.openReview(AMOUNT);
    await expect(bridge.modalRow('Bridge type')).toContainText('CCTP');
    await bridge.confirmButton().click();
    await expectTransactionSuccess(isolatedPage, { title: 'Bridge initiated!', timeout: 90_000 });
    await iris.attest(NetworkName.base, await awaitDepositTxHash(isolatedPage, 'ethereum'));
    const card = bridge.card('Ethereum');
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Ready to claim', { timeout: 90_000 });

    // A fee on the wrapper's sell: the claim would end in USDC, not USDS.
    const tin = encodeFunctionData({ abi: WRAPPER_TIN_ABI, functionName: 'tin' });
    const reopen = await stubForkCalls(isolatedPage, NetworkName.mainnet, (target, callData) =>
      same(target, USDS_PSM_WRAPPER) && same(callData, tin)
        ? encodeFunctionResult({ abi: WRAPPER_TIN_ABI, functionName: 'tin', result: 10n ** 15n })
        : undefined
    );
    const sent = await recordSends(isolatedPage);
    const { nonce } = await l1AccountState(testAccount);
    await card.getByTestId('pending-bridge-action').click();
    await expect(isolatedPage.getByRole('dialog')).toContainText('CCTP is paused.', { timeout: 90_000 });
    expect(sent).not.toContain(getAddress(MESSAGE_TRANSMITTER_V2));
    expect((await l1AccountState(testAccount)).nonce).toBe(nonce);
    await isolatedPage.getByTestId('transaction-modal-close').click();
    await expect(card.getByTestId('pending-bridge-status')).toHaveText('Ready to claim');

    await reopen();
    await card.getByTestId('pending-bridge-action').click();
    await expectTransactionSuccess(isolatedPage, { title: 'Funds claimed successfully!', timeout: 90_000 });
    await expect
      .poll(async () => (await l1AccountState(testAccount)).usds - before, { timeout: 30_000 })
      .toBe(parseUnits(AMOUNT, 18));
  });
});
