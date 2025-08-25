import { getTokenDecimals, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useMemo } from 'react';
import { useChainId } from 'wagmi';

interface UseL2SavingsTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amount: bigint;
  originToken: Token;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateSUsdsBalance: () => void;
}

export const useL2SavingsTransactionCallbacks = ({
  amount,
  originToken,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  mutateAllowance,
  mutateOriginBalance,
  mutateSUsdsBalance
}: UseL2SavingsTransactionCallbacksParameters) => {
  const { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const chainId = useChainId();
  const { i18n } = useLingui();
  const locale = i18n.locale;

  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateAllowance();
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Supplying ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Supply successful`,
          notificationDescription: t`You supplied ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Supply failed`,
          notificationDescription: t`Something went wrong with your transaction. Please try again.`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();
      }
    }),
    [
      amount,
      chainId,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateSUsdsBalance,
      originToken
    ]
  );
  const withdrawTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onMutate: () => {
        mutateAllowance();
        handleOnMutate();
      },
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Withdrawing ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Withdraw successful`,
          notificationDescription: t`You withdrew ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Withdraw failed`,
          notificationDescription: t`Something went wrong with your withdraw. Please try again.`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();
      }
    }),
    [
      amount,
      chainId,
      handleOnError,
      handleOnMutate,
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateSUsdsBalance,
      originToken
    ]
  );

  return { supplyTransactionCallbacks, withdrawTransactionCallbacks };
};
