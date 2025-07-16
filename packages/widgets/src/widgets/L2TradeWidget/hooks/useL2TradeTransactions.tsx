import { TokenForChain, useBatchPsmSwapExactIn, useBatchPsmSwapExactOut } from '@jetstreamgg/sky-hooks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useL2TradeTransactionCallbacks } from './useL2TradeTransactionCallbacks';
import { useContext } from 'react';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { TradeAction } from '@widgets/widgets/TradeWidget/lib/constants';

interface UseL2TradeTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  originAmount: bigint;
  originToken: TokenForChain | undefined;
  targetAmount: bigint;
  targetToken: TokenForChain | undefined;
  referralCode: number | undefined;
  maxAmountInForWithdraw: bigint;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateTargetBalance: () => void;
  setShowAddToken: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useL2TradeTransactions = ({
  originAmount,
  originToken,
  targetToken,
  targetAmount,
  referralCode,
  maxAmountInForWithdraw,
  shouldUseBatch,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  mutateAllowance,
  mutateOriginBalance,
  mutateTargetBalance,
  setShowAddToken
}: UseL2TradeTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);

  const { tradeTransactionCallbacks, tradeOutTransactionCallbacks } = useL2TradeTransactionCallbacks({
    originAmount,
    originToken,
    targetAmount,
    targetToken,
    mutateAllowance,
    mutateOriginBalance,
    mutateTargetBalance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification,
    setShowAddToken
  });

  const batchTrade = useBatchPsmSwapExactIn({
    amountIn: originAmount,
    assetIn: originToken?.address as `0x${string}`,
    assetOut: targetToken?.address as `0x${string}`,
    minAmountOut: targetAmount,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    shouldUseBatch,
    enabled:
      (widgetState.action === TradeAction.TRADE || widgetState.action === TradeAction.APPROVE) &&
      !!(originToken?.address && targetToken?.address),
    ...tradeTransactionCallbacks
  });

  const batchTradeOut = useBatchPsmSwapExactOut({
    amountOut: targetAmount,
    assetIn: originToken?.address as `0x${string}`,
    assetOut: targetToken?.address as `0x${string}`,
    maxAmountIn: originToken?.symbol === 'sUSDS' ? maxAmountInForWithdraw : originAmount,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    shouldUseBatch,
    enabled:
      (widgetState.action === TradeAction.TRADE || widgetState.action === TradeAction.APPROVE) &&
      !!(originToken?.address && targetToken?.address),
    ...tradeOutTransactionCallbacks
  });

  return { batchTrade, batchTradeOut };
};
