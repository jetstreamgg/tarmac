import { Token, TOKENS, useBatchPsmSwapExactIn, useBatchPsmSwapExactOut } from '@jetstreamgg/sky-hooks';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { SavingsAction } from '@widgets/widgets/SavingsWidget/lib/constants';
import { useContext } from 'react';
import { useChainId } from 'wagmi';
import { useL2SavingsTransactionCallbacks } from './useL2SavingsTransactionCallbacks';

interface UseL2SavingsTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  originToken: Token;
  amount: bigint;
  isMaxWithdraw: boolean;
  supplyMinAmountOut: bigint;
  referralCode: number | undefined;
  minAmountOutForWithdrawAll: bigint;
  maxAmountInForWithdraw: bigint;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  sUsdsBalance: bigint | undefined;
  mutateSUsdsBalance: () => void;
}

export const useL2SavingsTransactions = ({
  originToken,
  amount,
  isMaxWithdraw,
  supplyMinAmountOut,
  referralCode,
  sUsdsBalance,
  minAmountOutForWithdrawAll,
  maxAmountInForWithdraw,
  shouldUseBatch,
  mutateAllowance,
  mutateOriginBalance,
  mutateSUsdsBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseL2SavingsTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const chainId = useChainId();

  const { supplyTransactionCallbacks, withdrawTransactionCallbacks } = useL2SavingsTransactionCallbacks({
    amount,
    originToken,
    mutateAllowance,
    mutateOriginBalance,
    mutateSUsdsBalance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const batchSavingsSupply = useBatchPsmSwapExactIn({
    amountIn: amount,
    assetIn: originToken.address[chainId],
    assetOut: TOKENS.susds.address[chainId],
    minAmountOut: supplyMinAmountOut,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    shouldUseBatch,
    enabled:
      (widgetState.action === SavingsAction.SUPPLY || widgetState.action === SavingsAction.APPROVE) &&
      supplyMinAmountOut > 0n,
    ...supplyTransactionCallbacks
  });

  // use this to withdraw all from savings
  const batchSavingsWithdrawAll = useBatchPsmSwapExactIn({
    amountIn: sUsdsBalance || 0n,
    assetIn: TOKENS.susds.address[chainId],
    assetOut: originToken.address[chainId],
    minAmountOut: minAmountOutForWithdrawAll,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    shouldUseBatch,
    enabled:
      (widgetState.action === SavingsAction.WITHDRAW || widgetState.action === SavingsAction.APPROVE) &&
      isMaxWithdraw,
    ...withdrawTransactionCallbacks
  });

  // use this to withdraw a specific amount from savings
  const batchSavingsWithdraw = useBatchPsmSwapExactOut({
    amountOut: amount,
    assetOut: originToken.address[chainId],
    assetIn: TOKENS.susds.address[chainId],
    maxAmountIn: maxAmountInForWithdraw,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    shouldUseBatch,
    enabled:
      (widgetState.action === SavingsAction.WITHDRAW || widgetState.action === SavingsAction.APPROVE) &&
      !isMaxWithdraw,
    ...withdrawTransactionCallbacks
  });

  return {
    batchSavingsSupply,
    batchSavingsWithdraw: isMaxWithdraw ? batchSavingsWithdrawAll : batchSavingsWithdraw
  };
};
