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
  TOKEN_MINTER_V2,
  USDS_PSM_WRAPPER,
  cctpL2Contracts,
  messageTransmitterV2Abi,
  tokenMinterV2Abi,
  type CctpL2NetworkId
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

// APP-646: CCTP's gate from an L2 to Ethereum, read short or closed for this page only (the
// forks are shared by every worker), so the route falls back, blocks or refuses before a send.

const TENDERLY_RPC = 'https://virtual.**.rpc.tenderly.co/**';
const AMOUNT = '2';
const POCKET_ABI = parseAbi(['function pocket() view returns (address)']);
const WRAPPER_TIN_ABI = parseAbi(['function tin() view returns (uint256)']);

/** SkyLink copy once CCTP falls back because PSM3's pocket cannot pay the swap. */
const FALLBACKS = [
  { network: 'base', name: 'Base', eta: '5 days', action: 'Prove', footnote: 'come back to Ethereum twice' },
  {
    network: 'optimism',
    name: 'OP Mainnet',
    eta: '7 days',
    action: 'Prove',
    footnote: 'come back to Ethereum twice'
  },
  {
    network: 'unichain',
    name: 'Unichain',
    eta: '7 days',
    action: 'Prove',
    footnote: 'come back to Ethereum twice'
  },
  {
    network: 'arbitrum',
    name: 'Arbitrum One',
    eta: '6.5 days',
    action: 'Finalize',
    footnote: 'finalize it on Ethereum to receive your USDS'
  }
] as const satisfies readonly {
  network: CctpL2NetworkId;
  name: string;
  eta: string;
  action: 'Prove' | 'Finalize';
  footnote: string;
}[];

/** Where PSM3 on that L2 fork keeps the USDC it swaps out. */
async function psm3Pocket(network: CctpL2NetworkId): Promise<Address> {
  const rpc = rpcAt(await getRpcUrlFromFile(NetworkName[network]));
  const data = await rpc('eth_call', [
    {
      to: cctpL2Contracts(network).psm3,
      data: encodeFunctionData({ abi: POCKET_ABI, functionName: 'pocket' })
    },
    'latest'
  ]);
  return decodeFunctionResult({ abi: POCKET_ABI, functionName: 'pocket', data });
}

/** Above the test amount on every L2, including OP Mainnet where one burn carries 1 USDC. */
const OPEN_BURN_LIMIT = 10n ** 12n;

/**
 * That L2's gate as this page reads it. CCTP's pause and burn cap read open, so a short
 * pocket is the reason the route falls back. Unichain's minter has no code on the fork,
 * and OP Mainnet's cap is 1 USDC, so those reads are answered here. SkyLink reads closed
 * while `skyLinkClosed()`.
 */
const l2Gate =
  (
    network: CctpL2NetworkId,
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
    const { usdc } = cctpL2Contracts(network);
    const skyLink = l2WithdrawalBridge(network).bridge;
    const minterPaused = encodeFunctionData({ abi: tokenMinterV2Abi, functionName: 'paused' });
    const transmitterPaused = encodeFunctionData({ abi: messageTransmitterV2Abi, functionName: 'paused' });
    if (
      (same(target, TOKEN_MINTER_V2) && same(callData, minterPaused)) ||
      (same(target, MESSAGE_TRANSMITTER_V2) && same(callData, transmitterPaused))
    )
      return encodeFunctionResult({ abi: tokenMinterV2Abi, functionName: 'paused', result: false });
    if (
      same(target, TOKEN_MINTER_V2) &&
      same(
        callData,
        encodeFunctionData({
          abi: tokenMinterV2Abi,
          functionName: 'burnLimitsPerMessage',
          args: [usdc]
        })
      )
    )
      return encodeFunctionResult({
        abi: tokenMinterV2Abi,
        functionName: 'burnLimitsPerMessage',
        result: OPEN_BURN_LIMIT
      });
    const usdcBalance = pocketUsdc();
    if (
      usdcBalance !== undefined &&
      same(target, usdc) &&
      same(callData, encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [pocket] }))
    )
      return encodeFunctionResult({ abi: erc20Abi, functionName: 'balanceOf', result: usdcBalance });
    if (
      skyLinkClosed() &&
      same(target, skyLink) &&
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

/** The wallet on `network` with the form on that L2 to Ethereum. */
async function openOn(page: Page, network: CctpL2NetworkId) {
  const bridge = new BridgePage(page);
  await bridge.gotoConnected();
  await switchWalletNetwork(page, tenderlyChainLabel(NetworkName[network]));
  await bridge.expectBalanceLoaded();
  await expect(bridge.toNetwork()).toContainText('Ethereum');
  return bridge;
}

test.describe('Bridge: CCTP gate from an L2 to Ethereum', () => {
  for (const { network, name, eta, action, footnote } of FALLBACKS) {
    test(`${name}: without the USDC on PSM3, Review opens on SkyLink and Confirm sends the native withdrawal`, async ({
      isolatedPage,
      testAccount
    }) => {
      test.setTimeout(180_000);
      const { psm3 } = cctpL2Contracts(network);
      const skyLink = l2WithdrawalBridge(network).bridge;
      await stubForkCalls(
        isolatedPage,
        NetworkName[network],
        l2Gate(network, await psm3Pocket(network), { pocketUsdc: () => 0n })
      );
      const bridge = await openOn(isolatedPage, network);
      const sent = await recordSends(isolatedPage);
      const before = await l2UsdsBalance(network, testAccount);

      await bridge.openReview(AMOUNT);
      await expect(bridge.modalRow('Bridge type')).toContainText('SkyLink');
      await expect(bridge.modalRow('Estimated arrival')).toContainText(`~${eta}`);
      await expect(isolatedPage.getByTestId('bridge-modal-footnote')).toContainText(footnote);
      await expect(isolatedPage.getByText('CCTP route unavailable')).toBeVisible();
      await expect(
        isolatedPage.getByText(`Not enough USDC liquidity on ${name} for CCTP.`, { exact: false })
      ).toBeVisible();
      await expect(
        isolatedPage.getByText(`We switched you to SkyLink, which takes about ${eta}.`, { exact: false })
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
      expect(sent.at(-1)).toBe(getAddress(skyLink));
      expect(sent).not.toContain(getAddress(psm3));
      expect(sent).not.toContain(getAddress(TOKEN_MESSENGER_V2));
      await expect
        .poll(async () => before - (await l2UsdsBalance(network, testAccount)), { timeout: 30_000 })
        .toBe(parseUnits(AMOUNT, 18));
      const card = bridge.card('Ethereum');
      await expect(card.getByTestId('pending-bridge-status')).toHaveText('Pending', { timeout: 60_000 });
      await expect(card).toContainText('SkyLink');
      await expect(card.getByTestId('pending-bridge-action')).toHaveText(action);
    });

    test(`${name}: without the USDC on PSM3 and with SkyLink closed, Review is blocked`, async ({
      isolatedPage
    }) => {
      await stubForkCalls(
        isolatedPage,
        NetworkName[network],
        l2Gate(network, await psm3Pocket(network), { pocketUsdc: () => 0n, skyLinkClosed: () => true })
      );
      const bridge = await openOn(isolatedPage, network);
      await bridge.fromAmount().fill(AMOUNT);
      await expect(bridge.blocked()).toHaveText(
        `Bridging from ${name} to Ethereum is unavailable right now. Try again later.`,
        { timeout: 60_000 }
      );
      await expect(bridge.reviewCta()).toBeDisabled();
    });
  }

  test('PSM3 liquidity that drops after Review is read again at Confirm, and nothing is sent', async ({
    isolatedPage,
    testAccount
  }) => {
    let drained = false;
    await stubForkCalls(
      isolatedPage,
      NetworkName.base,
      l2Gate('base', await psm3Pocket('base'), { pocketUsdc: () => (drained ? 0n : undefined) })
    );
    const bridge = await openOn(isolatedPage, 'base');
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
    const bridge = await openOn(isolatedPage, 'base');
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
