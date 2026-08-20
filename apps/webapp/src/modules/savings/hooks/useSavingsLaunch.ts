import { useMemo } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { t } from '@lingui/core/macro';
import {
  type Token,
  TOKENS,
  daiUsdsAddress,
  mcdDaiAddress,
  psm3L2Address,
  useBatchPsmSwapAndSavingsSupply,
  useBatchPsmSwapExactIn,
  useBatchPsmSwapExactOut,
  useBatchSavingsSupply,
  useBatchUpgradeAndSavingsSupply,
  useSavingsAllowance,
  useSavingsWithdraw,
  useTokenAllowance,
  usdsPsmWrapperAddress
} from '@/hooks';
import { isL2ChainId, math } from '@/utils';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { useUsdcSupplyGate } from './useUsdcSupplyGate';
import { toLaunchResult, useShouldUseBatch, type EngineLaunchResult } from '@/modules/ui/hooks/engineLaunch';

export type SavingsLaunchFlow = 'supply' | 'withdraw';

export interface UseSavingsLaunchParams {
  flow: SavingsLaunchFlow;
  /** Origin token: USDS / DAI on mainnet, the L2 token (USDS / USDC) on L2s. */
  originToken: Token;
  amount: bigint;
  max?: boolean;
  /**
   * Referral code. Encoded as `number` on the mainnet `deposit` args and as
   * `bigint` on the L2 PSM `swapExactIn` args — the orchestrator converts per
   * path. Do not unify the types; calldata parity depends on this.
   */
  referralCode?: number;
  /**
   * L2 PSM supply only: the minimum sUSDS out (slippage floor) for
   * `swapExactIn`. Computed by the panel from chi (see
   * `useSavingsSupplyMinAmountOut`) and passed straight through to the engine.
   */
  minAmountOut?: bigint;
  /**
   * L2 PSM withdraw only. `max` swaps the whole sUSDS balance out via
   * `swapExactIn(sUSDS → token)`; a specific amount caps the sUSDS in via
   * `swapExactOut(…, amountOut, maxAmountIn)`. All three are computed by the panel
   * from the PSM preview reads (mirroring the legacy L2 widget) and passed straight
   * through to the engines:
   *  - `sUsdsBalance` — the whole sUSDS balance (max withdraw `amountIn`)
   *  - `minAmountOutForWithdrawAll` — the origin token floor for a max withdraw
   *  - `maxAmountInForWithdraw` — the sUSDS ceiling for a specific-amount withdraw
   */
  sUsdsBalance?: bigint;
  minAmountOutForWithdrawAll?: bigint;
  maxAmountInForWithdraw?: bigint;
}

export type UseSavingsLaunchResult = EngineLaunchResult;

/**
 * The single seam between the redesigned Savings UI and the transaction
 * engines. Given a flow + origin token + amount it routes to the correct
 * (unmodified) call-builder engine hook, spreads the context's `txCallbacks`
 * into it, and labels the modal's steps.
 *
 * Routing (slices 01–04):
 *  - supply + USDS (mainnet) → `useBatchSavingsSupply` (optional approve → deposit)
 *  - supply + DAI  (mainnet) → `useBatchUpgradeAndSavingsSupply` (optional approve-DAI →
 *    daiToUsds → optional approve-USDS → deposit) — the multi-step path
 *  - supply + USDC (mainnet) → `useBatchPsmSwapAndSavingsSupply` (optional approve-USDC →
 *    psmWrapper.sellGem → optional approve-USDS → deposit) — the DAI path's shape with
 *    the PSM standing in for the upgrade, armed only while `useUsdcSupplyGate` is open
 *  - supply        (L2)      → `useBatchPsmSwapExactIn` (optional approve →
 *    psm.swapExactIn(token → sUSDS), referralCode as bigint)
 *  - withdraw      (mainnet) → `useSavingsWithdraw` (`max` resolves via maxWithdraw(owner))
 *
 * The engines own all calldata. Allowance reads here are READ ONLY — they label
 * the modal's approve steps; the approve/deposit/swap calls (and the USDT/allowance
 * derivation, landmine #1) are built entirely inside the engine hooks.
 */
export function useSavingsLaunch({
  flow,
  originToken,
  amount,
  max = false,
  referralCode,
  minAmountOut,
  sUsdsBalance,
  minAmountOutForWithdrawAll,
  maxAmountInForWithdraw
}: UseSavingsLaunchParams): UseSavingsLaunchResult {
  const { txCallbacks } = useTransaction();
  const { address } = useAccount();
  const chainId = useChainId();

  const shouldUseBatch = useShouldUseBatch();

  const isL2 = isL2ChainId(chainId);
  const isSupply = flow === 'supply';
  // DAI is a mainnet-only supply origin; on L2 the PSM path takes precedence.
  const isDai = isSupply && !isL2 && originToken.symbol === TOKENS.dai.symbol;
  // Mainnet USDC routes through the PSM wrapper before the deposit; on L2 USDC is
  // handled by the PSM3 swapExactIn engine instead.
  const isMainnetUsdc = isSupply && !isL2 && originToken.symbol === TOKENS.usdc.symbol;
  const isL2Withdraw = !isSupply && isL2;
  // What the USDC supply's USDS legs (approve + deposit) actually spend — the
  // wrapper mints `amount * 1e12` USDS at a zero fee.
  const usdcSupplyUsdsAmount = isMainnetUsdc ? math.convertUSDCtoWad(amount) : amount;

  // The PSM-wrapper switches the USDC leg inherits (live / sell-direction halt /
  // `tin`). Read HERE, not just in the form layer, so the invariant the engine
  // declares as a precondition is enforced at the seam that arms it: a nonzero
  // `tin` makes `sellGem` under-deliver and the sequential path would land the
  // swap and then fail the deposit. Off mainnet the wrapper has no address, the
  // reads stay disabled, and the gate never reaches an armed engine (`enabled`
  // already requires `isMainnetUsdc`). TanStack dedupes these with the form's own
  // copy, so the surfaces that already gate their confirm pay nothing for it.
  const usdcGate = useUsdcSupplyGate();
  const usdcGateOpen = usdcGate.ready && !usdcGate.blockedReason;

  // READ ONLY — used solely to label the modal's approve steps. The approve/deposit/swap
  // calls (and the USDT/allowance derivation, landmine #1) are built entirely inside
  // the engine hooks; TanStack dedupes these reads with the engines' own.
  const { data: usdsAllowance } = useSavingsAllowance();
  const { data: daiAllowance } = useTokenAllowance({
    chainId,
    contractAddress: mcdDaiAddress[chainId as keyof typeof mcdDaiAddress],
    owner: address,
    spender: daiUsdsAddress[chainId as keyof typeof daiUsdsAddress]
  });
  // L2 PSM supply assetIn (the origin token) → psm3L2 allowance (disabled on
  // mainnet: spender undefined).
  const { data: psmAllowance } = useTokenAllowance({
    chainId,
    contractAddress: originToken.address[chainId],
    owner: address,
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address]
  });
  // L2 PSM withdraw flips the assetIn to sUSDS → psm3L2 — a separate allowance.
  const { data: psmWithdrawAllowance } = useTokenAllowance({
    chainId,
    contractAddress: TOKENS.susds.address[chainId],
    owner: address,
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address]
  });
  // Mainnet USDC supply: the USDC → PSM-wrapper allowance (disabled off mainnet:
  // the wrapper has no address there, so the spender is undefined).
  const { data: usdcWrapperAllowance } = useTokenAllowance({
    chainId,
    contractAddress: TOKENS.usdc.address[chainId],
    owner: address,
    spender: usdsPsmWrapperAddress[chainId as keyof typeof usdsPsmWrapperAddress]
  });

  // The USDS approve on the USDC path covers the widened wad, not the 6-dec input.
  const needsUsdsApproval = isSupply && usdsAllowance !== undefined && usdsAllowance < usdcSupplyUsdsAmount;
  const needsDaiApproval = isDai && daiAllowance !== undefined && daiAllowance < amount;
  const needsUsdcWrapperApproval =
    isMainnetUsdc && usdcWrapperAllowance !== undefined && usdcWrapperAllowance < amount;
  const needsPsmApproval = isSupply && isL2 && psmAllowance !== undefined && psmAllowance < amount;
  // The sUSDS spent on a withdraw: the whole balance (max) or the exact-out ceiling.
  const withdrawApproveAmount = max ? (sUsdsBalance ?? 0n) : (maxAmountInForWithdraw ?? 0n);
  const needsPsmWithdrawApproval =
    isL2Withdraw && psmWithdrawAllowance !== undefined && psmWithdrawAllowance < withdrawApproveAmount;

  // L2 PSM referral is a bigint (mainnet deposit's is a number — do not unify).
  const psmReferralCode = referralCode ? BigInt(referralCode) : undefined;

  // Engines — the single source of truth for calldata. All four are called
  // unconditionally (React hooks rules) and gated by `enabled` to the active
  // flow + origin token + network; we only route to them and spread the callbacks.
  const supplyHook = useBatchSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isSupply && !isL2 && !isDai && !isMainnetUsdc,
    shouldUseBatch,
    ...txCallbacks
  });
  const upgradeHook = useBatchUpgradeAndSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isDai,
    shouldUseBatch,
    ...txCallbacks
  });
  const usdcSupplyHook = useBatchPsmSwapAndSavingsSupply({
    amount,
    ref: referralCode,
    enabled: isMainnetUsdc && usdcGateOpen,
    shouldUseBatch,
    ...txCallbacks
  });
  const psmSupplyHook = useBatchPsmSwapExactIn({
    assetIn: originToken.address[chainId],
    assetOut: TOKENS.susds.address[chainId],
    amountIn: amount,
    minAmountOut: minAmountOut ?? 0n,
    referralCode: psmReferralCode,
    enabled: isSupply && isL2,
    shouldUseBatch,
    ...txCallbacks
  });
  // L2 PSM withdraw, max: swap the whole sUSDS balance out (sUSDS → token).
  const psmWithdrawMaxHook = useBatchPsmSwapExactIn({
    assetIn: TOKENS.susds.address[chainId],
    assetOut: originToken.address[chainId],
    amountIn: sUsdsBalance ?? 0n,
    minAmountOut: minAmountOutForWithdrawAll ?? 0n,
    referralCode: psmReferralCode,
    enabled: isL2Withdraw && max,
    shouldUseBatch,
    ...txCallbacks
  });
  // L2 PSM withdraw, specific amount: take exactly `amount` token out, capping
  // the sUSDS in at `maxAmountInForWithdraw`.
  const psmWithdrawHook = useBatchPsmSwapExactOut({
    assetIn: TOKENS.susds.address[chainId],
    assetOut: originToken.address[chainId],
    amountOut: amount,
    maxAmountIn: maxAmountInForWithdraw ?? 0n,
    referralCode: psmReferralCode,
    enabled: isL2Withdraw && !max,
    shouldUseBatch,
    ...txCallbacks
  });
  const withdrawHook = useSavingsWithdraw({
    amount,
    max,
    enabled: !isSupply && !isL2,
    ...txCallbacks
  });

  const activeHook = isSupply
    ? isL2
      ? psmSupplyHook
      : isDai
        ? upgradeHook
        : isMainnetUsdc
          ? usdcSupplyHook
          : supplyHook
    : isL2
      ? max
        ? psmWithdrawMaxHook
        : psmWithdrawHook
      : withdrawHook;
  const execute = activeHook.execute;

  // Step labels mirror the engine's call count, each approve elided when its
  // allowance is already present so the step indicator advances in lockstep:
  //  - mainnet USDS supply / mainnet withdraw: optional approve → action
  //  - DAI supply: up to 4 (approve-DAI → upgrade → approve-USDS → supply)
  //  - mainnet USDC supply: up to 4 (approve-USDC → convert → approve-USDS → supply)
  //  - L2 PSM supply/withdraw: optional approve(assetIn → psm3L2) → swap
  // Hoisted from launch() so the editable modal entry body can pass them straight
  // to the shared modal; launch() consumes the same value (behaviour unchanged).
  const steps = useMemo<TransactionStep[]>(() => {
    // Failure copy per Figma 1030:139111 — shown under "Approve failed" when
    // the approval is the step that rolled back.
    const approveStep = (symbol: string): TransactionStep => ({
      label: t`Approve`,
      tokenSymbol: symbol,
      failureDetail: t`The ${symbol} hasn't been approved.`
    });
    if (isSupply) {
      return isL2
        ? needsPsmApproval
          ? [approveStep(originToken.symbol), { label: t`Supply`, tokenSymbol: originToken.symbol }]
          : [{ label: t`Supply`, tokenSymbol: originToken.symbol }]
        : isDai
          ? ([
              needsDaiApproval && approveStep('DAI'),
              t`Upgrade DAI to USDS`,
              needsUsdsApproval && approveStep('USDS'),
              { label: t`Supply`, tokenSymbol: 'USDS' }
            ].filter(Boolean) as TransactionStep[])
          : isMainnetUsdc
            ? ([
                needsUsdcWrapperApproval && approveStep('USDC'),
                t`Convert USDC to USDS`,
                needsUsdsApproval && approveStep('USDS'),
                { label: t`Supply`, tokenSymbol: 'USDS' }
              ].filter(Boolean) as TransactionStep[])
            : needsUsdsApproval
              ? [approveStep('USDS'), { label: t`Supply`, tokenSymbol: 'USDS' }]
              : [{ label: t`Supply`, tokenSymbol: 'USDS' }];
    }
    // The withdraw approval is for the sUSDS share token, not `originToken` —
    // it keeps the bare label rather than a wrong chip.
    return needsPsmWithdrawApproval
      ? [t`Approve`, { label: t`Withdraw`, tokenSymbol: originToken.symbol }]
      : [{ label: t`Withdraw`, tokenSymbol: originToken.symbol }];
  }, [
    isSupply,
    isL2,
    isDai,
    isMainnetUsdc,
    needsPsmApproval,
    needsDaiApproval,
    needsUsdcWrapperApproval,
    needsUsdsApproval,
    needsPsmWithdrawApproval,
    originToken.symbol
  ]);

  return toLaunchResult(activeHook, steps, execute);
}
