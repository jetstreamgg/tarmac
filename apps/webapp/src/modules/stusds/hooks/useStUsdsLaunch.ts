import { useMemo } from 'react';
import type { Call } from 'viem';
import { t } from '@lingui/core/macro';
import {
  StUsdsDirection,
  StUsdsProviderType,
  useBatchCurveSwap,
  useBatchStUsdsDeposit,
  useCurveAllowance,
  useIsBatchSupported,
  useStUsdsAllowance,
  useStUsdsWithdraw
} from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { useBatchToggle } from '@/modules/ui/hooks/useBatchToggle';

export type StUsdsLaunchFlow = 'supply' | 'withdraw';

/** The engine inputs the modal body derives and spreads in. */
export interface StUsdsEngineParams {
  flow: StUsdsLaunchFlow;
  /** USDS amount — the input on supply, the desired output on withdraw. */
  amount: bigint;
  /** Withdraw Max → the native engine redeems the whole share balance (no dust). */
  max?: boolean;
  /** Routing decision from `useStUsdsProviderSelection` (native vs Curve). */
  selectedProvider: StUsdsProviderType;
  /** Quoted output for the selected route (stUSDS on supply, USDS on withdraw). */
  expectedOutput: bigint;
  /** Curve withdrawals: the stUSDS input the quote says is needed for `amount` USDS. */
  stUsdsAmount?: bigint;
}

export interface UseStUsdsLaunchResult {
  /** Fires the routed engine call directly (txCallbacks already spread in). */
  execute: () => void;
  /** Step labels for the configured route, matching the engine's call count. */
  steps: string[];
  /** Whether the routed engine hook is ready to execute. */
  prepared: boolean;
  isLoading: boolean;
  error: Error | null;
  /** The routed engine's calls, for estimating the flow's network fee. */
  calls: Call[];
  /** Whether those calls go out bundled — the batch costs less than the sequence. */
  isBatch: boolean;
}

/**
 * The seam between the redesigned stUSDS modal and the (unmodified) engine
 * hooks — the stUSDS analogue of `useSavingsLaunch`/`useVaultLaunch`, carrying
 * the retired StUSDSWidget's provider routing verbatim:
 *  - supply, native  → `useBatchStUsdsDeposit` (approve → deposit)
 *  - supply, Curve   → `useBatchCurveSwap` SUPPLY (approve → exchange, min-output
 *                      slippage applied inside the engine at the config default)
 *  - withdraw, native → `useStUsdsWithdraw` (Max redeems shares to avoid dust)
 *  - withdraw, Curve  → `useBatchCurveSwap` WITHDRAW (stUSDS input from the quote)
 *
 * The engines own all calldata + their own allowance derivation; the allowance
 * reads here are READ ONLY and only label the approve steps (TanStack dedupes
 * them with the engines' own reads).
 */
export function useStUsdsLaunch({
  flow,
  amount,
  max = false,
  selectedProvider,
  expectedOutput,
  stUsdsAmount
}: StUsdsEngineParams): UseStUsdsLaunchResult {
  const { txCallbacks } = useTransaction();

  // Honour the user's batch toggle: bundle approve+deposit/swap into one
  // EIP-5792 call only when opted in AND supported. useTransactionFlow
  // additionally gates on calls.length > 1, so a no-approval action stays a
  // single signature (the native withdraw is a plain write and unaffected).
  const [batchEnabled] = useBatchToggle();
  const { data: batchSupported } = useIsBatchSupported();
  const shouldUseBatch = !!batchEnabled && !!batchSupported;

  const isSupply = flow === 'supply';
  const isCurve = selectedProvider === StUsdsProviderType.CURVE;

  // READ ONLY — label the approve steps only. Same reads as the engines' own.
  const { data: nativeSupplyAllowance } = useStUsdsAllowance();
  const { hasAllowance: hasCurveUsdsAllowance } = useCurveAllowance({ token: 'USDS', amount });
  const { hasAllowance: hasCurveStUsdsAllowance } = useCurveAllowance({
    token: 'stUSDS',
    amount: stUsdsAmount ?? 0n
  });
  const needsAllowance = isSupply
    ? isCurve
      ? !hasCurveUsdsAllowance
      : nativeSupplyAllowance === undefined || nativeSupplyAllowance < amount
    : isCurve
      ? !hasCurveStUsdsAllowance
      : false;

  // All four engines are called unconditionally (hooks rules) and gated by
  // `enabled` to the active flow + route — the same routing the widget's
  // useStUsdsTransactions performed.
  const nativeDeposit = useBatchStUsdsDeposit({
    amount,
    referral: REFERRAL_CODE,
    shouldUseBatch,
    enabled: isSupply && !isCurve,
    ...txCallbacks
  });
  const nativeWithdraw = useStUsdsWithdraw({
    amount,
    max,
    enabled: !isSupply && !isCurve,
    ...txCallbacks
  });
  const curveSupply = useBatchCurveSwap({
    direction: StUsdsDirection.SUPPLY,
    inputAmount: amount,
    expectedOutput,
    shouldUseBatch,
    enabled: isSupply && isCurve,
    ...txCallbacks
  });
  // minOut must derive from the same quote that produced stUsdsAmount: on a max withdraw the UI
  // amount and the routed quote are seeded by separate provider selections and can diverge.
  // The zero check matters because calculateMinOutputWithSlippage has no guard of its own.
  const curveWithdraw = useBatchCurveSwap({
    direction: StUsdsDirection.WITHDRAW,
    inputAmount: stUsdsAmount ?? 0n,
    expectedOutput,
    shouldUseBatch,
    enabled: !isSupply && isCurve && (stUsdsAmount ?? 0n) > 0n && expectedOutput > 0n,
    ...txCallbacks
  });

  const activeHook = isSupply
    ? isCurve
      ? curveSupply
      : nativeDeposit
    : isCurve
      ? curveWithdraw
      : nativeWithdraw;

  // Step labels mirror the engine's call count so the indicator advances in
  // lockstep. The Curve swap is still "Supply"/"Withdraw" to the user — the
  // route is communicated by the provider notice, not the step names.
  const steps = useMemo<string[]>(() => {
    if (isSupply) return needsAllowance ? [t`Approve USDS`, t`Supply USDS`] : [t`Supply USDS`];
    return needsAllowance ? [t`Approve stUSDS`, t`Withdraw USDS`] : [t`Withdraw USDS`];
  }, [isSupply, needsAllowance]);

  // The native withdraw is a plain write hook whose prepare simulation can fail
  // (e.g. constrained module liquidity) — surface that like an engine error.
  const prepareError = 'prepareError' in activeHook ? (activeHook.prepareError as Error | null) : null;

  return {
    execute: activeHook.execute,
    steps,
    prepared: activeHook.prepared,
    isLoading: activeHook.isLoading,
    error: activeHook.error ?? prepareError,
    calls: activeHook.calls ?? [],
    isBatch: !!activeHook.isBatch
  };
}
