import { getTokenDecimals, TokenForChain } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { notificationTypeMaping } from '@widgets/shared/constants';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useContext, useMemo } from 'react';
import { useChainId } from 'wagmi';

interface UseL2TradeTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  originAmount: bigint;
  originToken: TokenForChain | undefined;
  targetAmount: bigint;
  targetToken: TokenForChain | undefined;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateTargetBalance: () => void;
  setShowAddToken: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useL2TradeTransactionCallbacks = ({
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
}: UseL2TradeTransactionCallbacksParameters) => {
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const { setBackButtonText } = useContext(WidgetContext);
  const chainId = useChainId();
  const { i18n } = useLingui();
  const locale = i18n.locale;

  const tradeTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateAllowance();
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Trading ${formatBigInt(originAmount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken?.symbol ?? ''}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Trade successful`,
          notificationDescription: t`You traded ${formatBigInt(originAmount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken?.symbol ?? ''} for ${formatBigInt(targetAmount, {
            locale,
            unit: targetToken && getTokenDecimals(targetToken, chainId)
          })} ${targetToken?.symbol ?? ''}`,
          notificationType: notificationTypeMaping[targetToken?.symbol?.toUpperCase() || 'none']
        });
        setBackButtonText(t`Back to Trade`);
        mutateAllowance();
        mutateOriginBalance();
        mutateTargetBalance();
        setShowAddToken(true);
      },
      onError: (error: Error, hash: string | undefined) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Trade failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
      }
    }),
    [
      chainId,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateTargetBalance,
      originAmount,
      originToken,
      setBackButtonText,
      setShowAddToken,
      targetAmount,
      targetToken
    ]
  );

  const tradeOutTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateAllowance();
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Trading ${formatBigInt(originAmount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken?.symbol ?? ''}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Trade successful`,
          notificationDescription: t`You traded ${formatBigInt(originAmount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken?.symbol ?? ''} for ${formatBigInt(targetAmount, {
            locale,
            unit: targetToken && getTokenDecimals(targetToken, chainId)
          })} ${targetToken?.symbol ?? ''}`,
          notificationType: notificationTypeMaping[targetToken?.symbol?.toUpperCase() || 'none']
        });
        setBackButtonText(t`Back to Trade`);
        mutateAllowance();
        mutateOriginBalance();
        mutateTargetBalance();
        setShowAddToken(true);
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Trade failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
      }
    }),
    [
      chainId,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateTargetBalance,
      originAmount,
      originToken,
      setBackButtonText,
      setShowAddToken,
      targetAmount,
      targetToken
    ]
  );

  return { tradeTransactionCallbacks, tradeOutTransactionCallbacks };
};
