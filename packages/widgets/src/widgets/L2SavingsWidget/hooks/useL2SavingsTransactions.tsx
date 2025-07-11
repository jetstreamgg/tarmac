import {
  psm3L2Address,
  Token,
  TOKENS,
  useApproveToken,
  useBatchPsmSwapExactIn,
  useBatchPsmSwapExactOut,
  usePsmSwapExactIn,
  usePsmSwapExactOut
} from '@jetstreamgg/sky-hooks';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { SavingsAction, SavingsFlow } from '@widgets/widgets/SavingsWidget/lib/constants';
import { useContext } from 'react';
import { useChainId } from 'wagmi';
import { useL2SavingsTransactionCallbacks } from './useL2SavingsTransactionCallbacks';
import { TxStatus } from '@widgets/shared/constants';

interface UseL2SavingsTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amountToApprove: bigint | undefined;
  allowance: bigint | undefined;
  originToken: Token;
  amount: bigint;
  isMaxWithdraw: boolean;
  supplyMinAmountOut: bigint;
  referralCode: number | undefined;
  minAmountOutForWithdrawAll: bigint;
  maxAmountInForWithdraw: bigint;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  sUsdsBalance: bigint | undefined;
  mutateSUsdsBalance: () => void;
}

export const useL2SavingsTransactions = ({
  amountToApprove,
  allowance,
  originToken,
  amount,
  isMaxWithdraw,
  supplyMinAmountOut,
  referralCode,
  sUsdsBalance,
  minAmountOutForWithdrawAll,
  maxAmountInForWithdraw,
  mutateAllowance,
  mutateOriginBalance,
  mutateSUsdsBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseL2SavingsTransactionsParameters) => {
  const { widgetState, txStatus } = useContext(WidgetContext);
  const chainId = useChainId();

  const { approveTransactionCallbacks, supplyTransactionCallbacks, withdrawTransactionCallbacks } =
    useL2SavingsTransactionCallbacks({
      amount,
      originToken,
      isMaxWithdraw,
      mutateAllowance,
      mutateOriginBalance,
      mutateSUsdsBalance,
      retryPrepareSupply: () => savingsSupply.retryPrepare(),
      retryPrepareWithdraw: () => savingsWithdraw.retryPrepare(),
      retryPrepareWithdrawAll: () => savingsWithdrawAll.retryPrepare(),
      addRecentTransaction,
      onWidgetStateChange,
      onNotification
    });

  const savingsApprove = useApproveToken({
    amount: amountToApprove,
    contractAddress:
      widgetState.flow === SavingsFlow.SUPPLY ? originToken.address[chainId] : TOKENS.susds.address[chainId],
    spender: psm3L2Address[chainId as keyof typeof psm3L2Address],
    enabled: widgetState.action === SavingsAction.APPROVE && allowance !== undefined,
    ...approveTransactionCallbacks
  });

  const savingsSupplyParams = {
    amountIn: amount,
    assetIn: originToken.address[chainId],
    assetOut: TOKENS.susds.address[chainId],
    minAmountOut: supplyMinAmountOut,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    ...supplyTransactionCallbacks
  };

  const savingsSupply = usePsmSwapExactIn({
    ...savingsSupplyParams,
    enabled: widgetState.action === SavingsAction.SUPPLY && allowance !== undefined && supplyMinAmountOut > 0n
  });

  const batchSavingsSupply = useBatchPsmSwapExactIn({
    ...savingsSupplyParams,
    enabled:
      (widgetState.action === SavingsAction.SUPPLY || widgetState.action === SavingsAction.APPROVE) &&
      supplyMinAmountOut > 0n
  });

  const savingsWithdrawAllParams = {
    amountIn: sUsdsBalance || 0n,
    assetIn: TOKENS.susds.address[chainId],
    assetOut: originToken.address[chainId],
    minAmountOut: minAmountOutForWithdrawAll,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    ...withdrawTransactionCallbacks
  };

  // use this to withdraw all from savings
  const savingsWithdrawAll = usePsmSwapExactIn({
    ...savingsWithdrawAllParams,
    enabled:
      (widgetState.action === SavingsAction.WITHDRAW ||
        (widgetState.action === SavingsAction.APPROVE && txStatus === TxStatus.SUCCESS)) &&
      isMaxWithdraw &&
      allowance !== undefined
  });

  const batchSavingsWithdrawAll = useBatchPsmSwapExactIn({
    ...savingsWithdrawAllParams,
    enabled:
      (widgetState.action === SavingsAction.WITHDRAW || widgetState.action === SavingsAction.APPROVE) &&
      isMaxWithdraw
  });

  const savingsWithdrawParams = {
    amountOut: amount,
    assetOut: originToken.address[chainId],
    assetIn: TOKENS.susds.address[chainId],
    maxAmountIn: maxAmountInForWithdraw,
    referralCode: referralCode ? BigInt(referralCode) : undefined,
    ...withdrawTransactionCallbacks
  };

  // use this to withdraw a specific amount from savings
  const savingsWithdraw = usePsmSwapExactOut({
    ...savingsWithdrawParams,
    enabled:
      (widgetState.action === SavingsAction.WITHDRAW ||
        (widgetState.action === SavingsAction.APPROVE && txStatus === TxStatus.SUCCESS)) &&
      !isMaxWithdraw &&
      allowance !== undefined
  });

  const batchSavingsWithdraw = useBatchPsmSwapExactOut({
    ...savingsWithdrawParams,
    enabled:
      (widgetState.action === SavingsAction.WITHDRAW || widgetState.action === SavingsAction.APPROVE) &&
      !isMaxWithdraw
  });

  return {
    savingsApprove,
    savingsSupply,
    batchSavingsSupply,
    savingsWithdrawAll,
    batchSavingsWithdrawAll,
    savingsWithdraw,
    batchSavingsWithdraw
  };
};
