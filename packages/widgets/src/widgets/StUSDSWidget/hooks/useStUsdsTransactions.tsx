import {
  useBatchStUsdsDeposit,
  useStUsdsWithdraw,
  useBatchCurveSwap,
  StUsdsProviderType,
  StUsdsDirection
} from '@jetstreamgg/sky-hooks';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useContext } from 'react';
import { StUSDSAction } from '../lib/constants';
import { useStUsdsTransactionCallbacks } from './useStUsdsTransactionCallbacks';

interface UseStUsdsTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amount: bigint;
  referralCode: number | undefined;
  max: boolean;
  shouldUseBatch: boolean;
  mutateNativeSupplyAllowance: () => void;
  mutateStUsds: () => void;
  mutateCurveUsdsAllowance?: () => void;
  mutateCurveStUsdsAllowance?: () => void;
  selectedProvider: StUsdsProviderType;
  expectedOutput: bigint;
  /**
   * stUSDS amount for Curve withdrawals.
   * For withdrawals via Curve, this is the stUSDS input needed to receive the desired USDS output.
   * For deposits, this is ignored (amount is used as USDS input).
   */
  stUsdsAmount?: bigint;
}

export const useStUsdsTransactions = ({
  amount,
  referralCode,
  max,
  shouldUseBatch,
  mutateNativeSupplyAllowance,
  mutateStUsds,
  mutateCurveUsdsAllowance,
  mutateCurveStUsdsAllowance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  selectedProvider,
  expectedOutput,
  stUsdsAmount
}: UseStUsdsTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const { supplyTransactionCallbacks, withdrawTransactionCallbacks } = useStUsdsTransactionCallbacks({
    amount,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification,
    mutateNativeSupplyAllowance,
    mutateStUsds,
    mutateCurveUsdsAllowance,
    mutateCurveStUsdsAllowance,
    selectedProvider
  });

  const isCurve = selectedProvider === StUsdsProviderType.CURVE;

  // Native stUSDS deposit
  const batchStUsdsDeposit = useBatchStUsdsDeposit({
    amount,
    referral: referralCode,
    shouldUseBatch,
    enabled:
      !isCurve && (widgetState.action === StUSDSAction.SUPPLY || widgetState.action === StUSDSAction.APPROVE),
    ...supplyTransactionCallbacks
  });

  // Native stUSDS withdraw
  const stUsdsWithdraw = useStUsdsWithdraw({
    amount,
    max,
    enabled: !isCurve && widgetState.action === StUSDSAction.WITHDRAW,
    ...withdrawTransactionCallbacks
  });

  // Curve swap for supply (USDS -> stUSDS)
  // Input: USDS (amount from UI), Output: stUSDS (expectedOutput from quote)
  const curveSupplySwap = useBatchCurveSwap({
    direction: StUsdsDirection.SUPPLY,
    inputAmount: amount,
    expectedOutput,
    shouldUseBatch,
    enabled:
      isCurve && (widgetState.action === StUSDSAction.SUPPLY || widgetState.action === StUSDSAction.APPROVE),
    ...supplyTransactionCallbacks
  });

  // Curve swap for withdraw (stUSDS -> USDS)
  // Input: stUSDS (stUsdsAmount from quote), Output: USDS
  // Note: For normal withdrawals, stUsdsAmount is calculated via get_dx from desired USDS.
  // For max withdrawals, stUsdsAmount is the user's full stUSDS balance and amount is calculated via get_dy.
  const curveWithdrawSwap = useBatchCurveSwap({
    direction: StUsdsDirection.WITHDRAW,
    inputAmount: stUsdsAmount ?? 0n, // stUSDS to swap (from quote)
    expectedOutput: amount, // Quoted USDS output (slippage applied internally by hook)
    shouldUseBatch,
    enabled: isCurve && widgetState.action === StUSDSAction.WITHDRAW && (stUsdsAmount ?? 0n) > 0n,
    ...withdrawTransactionCallbacks
  });

  // Return the appropriate hooks based on provider
  return {
    batchStUsdsDeposit: isCurve ? curveSupplySwap : batchStUsdsDeposit,
    stUsdsWithdraw: isCurve ? curveWithdrawSwap : stUsdsWithdraw
  };
};
