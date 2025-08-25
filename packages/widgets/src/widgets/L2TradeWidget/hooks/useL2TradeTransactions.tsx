import {
  psm3L2Address,
  TokenForChain,
  useApproveToken,
  useBatchPsmSwapExactIn,
  useBatchPsmSwapExactOut,
  usePsmSwapExactIn,
  usePsmSwapExactOut
} from '@jetstreamgg/sky-hooks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useChainId } from 'wagmi';
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
  allowance: bigint | undefined;
  referralCode: number | undefined;
  maxAmountInForWithdraw: bigint;
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
  allowance,
  referralCode,
  maxAmountInForWithdraw,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  mutateAllowance,
  mutateOriginBalance,
  mutateTargetBalance,
  setShowAddToken
}: UseL2TradeTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const chainId = useChainId();

  const { approveTransactionCallbacks, tradeTransactionCallbacks, tradeOutTransactionCallbacks } =
    useL2TradeTransactionCallbacks({
      originAmount,
      originToken,
      targetAmount,
      targetToken,
      mutateAllowance,
      mutateOriginBalance,
      mutateTargetBalance,
      retryTradePrepare: () => trade.retryPrepare(),
      retryTradeOutPrepare: () => tradeOut.retryPrepare(),
      addRecentTransaction,
      onWidgetStateChange,
      onNotification,
      setShowAddToken
    });

  const approve = useApproveToken({
    amount: originAmount,
    contractAddress: originToken?.address,
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address],
    enabled: widgetState.action === TradeAction.APPROVE && allowance !== undefined && !!originToken,
    ...approveTransactionCallbacks
  });

  const tradeParams = {
    amountIn: originAmount,
    assetIn: originToken?.address as `0x${string}`,
    assetOut: targetToken?.address as `0x${string}`,
    minAmountOut: targetAmount,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    ...tradeTransactionCallbacks
  };

  const trade = usePsmSwapExactIn({
    ...tradeParams,
    enabled: widgetState.action === TradeAction.TRADE && !!(originToken?.address && targetToken?.address)
  });

  const batchTrade = useBatchPsmSwapExactIn({
    ...tradeParams,
    enabled:
      (widgetState.action === TradeAction.TRADE || widgetState.action === TradeAction.APPROVE) &&
      !!(originToken?.address && targetToken?.address)
  });

  const tradeOutParams = {
    amountOut: targetAmount,
    assetIn: originToken?.address as `0x${string}`,
    assetOut: targetToken?.address as `0x${string}`,
    maxAmountIn: originToken?.symbol === 'sUSDS' ? maxAmountInForWithdraw : originAmount,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    ...tradeOutTransactionCallbacks
  };

  const tradeOut = usePsmSwapExactOut({
    ...tradeOutParams,
    enabled: widgetState.action === TradeAction.TRADE && !!(originToken?.address && targetToken?.address)
  });

  const batchTradeOut = useBatchPsmSwapExactOut({
    ...tradeOutParams,
    enabled:
      (widgetState.action === TradeAction.TRADE || widgetState.action === TradeAction.APPROVE) &&
      !!(originToken?.address && targetToken?.address)
  });

  return { approve, trade, batchTrade, tradeOut, batchTradeOut };
};
