import { useMemo } from 'react';
import { t } from '@lingui/core/macro';
import {
  StUsdsDirection,
  StUsdsProviderType,
  useBatchCurveSwap,
  useBatchStUsdsDeposit,
  useStUsdsWithdraw
} from '@/hooks';
import { REFERRAL_CODE } from '@/lib/constants';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { stepsFromPlan } from '@/modules/ui/components/transactionStepsModel';
import {
  planOf,
  toLaunchResult,
  useShouldUseBatch,
  type EngineLaunchResult
} from '@/modules/ui/hooks/engineLaunch';

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

export type UseStUsdsLaunchResult = EngineLaunchResult;

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
 * The engines own all calldata + their own allowance derivation; the steps are
 * read off the routed engine's plan.
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

  const shouldUseBatch = useShouldUseBatch();

  const isSupply = flow === 'supply';
  const isCurve = selectedProvider === StUsdsProviderType.CURVE;

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

  // Steps come off the routed engine's plan, so an approve shows exactly when
  // the engine sends one. The Curve swap is still "Supply"/"Withdraw" to the
  // user — the route is communicated by the provider notice, not the step names.
  // The native withdraw is a plain write with no plan; its single step is fixed.
  const activePlan = planOf(activeHook);
  const steps = useMemo<TransactionStep[]>(() => {
    if (isSupply) return stepsFromPlan(activePlan, [{ approve: t`Approve USDS`, action: t`Supply USDS` }]);
    if (!isCurve) return [t`Withdraw USDS`];
    return stepsFromPlan(activePlan, [{ approve: t`Approve stUSDS`, action: t`Withdraw USDS` }]);
  }, [isSupply, isCurve, activePlan]);

  return toLaunchResult(activeHook, steps);
}
