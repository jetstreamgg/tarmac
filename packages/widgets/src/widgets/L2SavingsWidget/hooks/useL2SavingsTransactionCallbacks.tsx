import { getTokenDecimals, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { t } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useTransactionCallbacks } from '@widgets/shared/hooks/useTransactionCallbacks';
import { TransactionCallbacks } from '@widgets/shared/types/transactionCallbacks';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { SavingsFlow } from '@widgets/widgets/SavingsWidget/lib/constants';
import { useContext, useMemo } from 'react';
import { useChainId } from 'wagmi';

interface UseL2SavingsTransactionCallbacksParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amount: bigint;
  originToken: Token;
  isMaxWithdraw: boolean;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateSUsdsBalance: () => void;
  retryPrepareSupply: () => void;
  retryPrepareWithdraw: () => void;
  retryPrepareWithdrawAll: () => void;
}

export const useL2SavingsTransactionCallbacks = ({
  amount,
  originToken,
  isMaxWithdraw,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  mutateAllowance,
  mutateOriginBalance,
  mutateSUsdsBalance,
  retryPrepareSupply,
  retryPrepareWithdraw,
  retryPrepareWithdrawAll
}: UseL2SavingsTransactionCallbacksParameters) => {
  const { handleOnStart, handleOnSuccess, handleOnError } = useTransactionCallbacks({
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });
  const { widgetState } = useContext(WidgetContext);
  const chainId = useChainId();
  const { i18n } = useLingui();
  const locale = i18n.locale;

  const approveTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
      onStart: hash => {
        handleOnStart({
          hash,
          recentTransactionDescription: t`Approving ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
      },
      onSuccess: hash => {
        handleOnSuccess({
          hash,
          notificationTitle: t`Approve successful`,
          notificationDescription: t`You approved ${formatBigInt(amount, {
            locale,
            unit: originToken && getTokenDecimals(originToken, chainId)
          })} ${originToken.symbol}`
        });
        mutateAllowance();
        mutateOriginBalance();
        mutateSUsdsBalance();

        const retryFunction =
          widgetState.flow === SavingsFlow.SUPPLY
            ? retryPrepareSupply
            : isMaxWithdraw
              ? retryPrepareWithdrawAll
              : retryPrepareWithdraw;
        retryFunction();
      },
      onError: (error, hash) => {
        handleOnError({
          error,
          hash,
          notificationTitle: t`Approval failed`,
          notificationDescription: t`We could not approve your token allowance.`
        });
        mutateAllowance();
      }
    }),
    [
      amount,
      chainId,
      handleOnError,
      handleOnStart,
      handleOnSuccess,
      isMaxWithdraw,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateSUsdsBalance,
      originToken,
      retryPrepareSupply,
      retryPrepareWithdraw,
      retryPrepareWithdrawAll,
      widgetState.flow
    ]
  );

  const supplyTransactionCallbacks = useMemo<TransactionCallbacks>(
    () => ({
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
      handleOnStart,
      handleOnSuccess,
      locale,
      mutateAllowance,
      mutateOriginBalance,
      mutateSUsdsBalance,
      originToken
    ]
  );

  return { approveTransactionCallbacks, supplyTransactionCallbacks, withdrawTransactionCallbacks };
};
