import { useCallback, useContext } from 'react';
import { WidgetProps } from '../types/widgetState';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { getTransactionLink, useIsSafeWallet } from '@jetstreamgg/sky-utils';
import { useAccount, useChainId } from 'wagmi';
import { NotificationType, TxStatus } from '../constants';

type UseTransactionCallbacksParameters = Pick<
  WidgetProps,
  'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'
>;

interface TransactionStartParameters {
  hash?: string;
  recentTransactionDescription: string;
}

interface TransactionSuccessParameters {
  hash: string | undefined;
  notificationTitle: string;
  notificationDescription: string;
  notificationType?: NotificationType;
}

interface TransactionErrorParameters {
  error: Error;
  hash: string | undefined;
  notificationTitle: string;
  notificationDescription: string;
}

export const useTransactionCallbacks = ({
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseTransactionCallbacksParameters) => {
  const { widgetState, setExternalLink, setTxStatus } = useContext(WidgetContext);

  const chainId = useChainId();
  const { address } = useAccount();
  const isSafeWallet = useIsSafeWallet();

  const handleOnStart = useCallback(
    ({ hash, recentTransactionDescription }: TransactionStartParameters) => {
      if (hash) {
        addRecentTransaction?.({
          hash,
          description: recentTransactionDescription
        });
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    [
      addRecentTransaction,
      address,
      chainId,
      isSafeWallet,
      onWidgetStateChange,
      setExternalLink,
      setTxStatus,
      widgetState
    ]
  );

  const handleOnSuccess = useCallback(
    ({
      hash,
      notificationTitle,
      notificationDescription,
      notificationType
    }: TransactionSuccessParameters) => {
      onNotification?.({
        title: notificationTitle,
        description: notificationDescription,
        status: TxStatus.SUCCESS,
        type: notificationType
      });
      setTxStatus(TxStatus.SUCCESS);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.SUCCESS });
    },
    [
      address,
      chainId,
      isSafeWallet,
      onNotification,
      onWidgetStateChange,
      setExternalLink,
      setTxStatus,
      widgetState
    ]
  );

  const handleOnError = useCallback(
    ({ error, hash, notificationTitle, notificationDescription }: TransactionErrorParameters) => {
      onNotification?.({
        title: notificationTitle,
        description: notificationDescription,
        status: TxStatus.ERROR
      });
      setTxStatus(TxStatus.ERROR);
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.ERROR });
      console.log(error);
    },
    [
      address,
      chainId,
      isSafeWallet,
      onNotification,
      onWidgetStateChange,
      setExternalLink,
      setTxStatus,
      widgetState
    ]
  );

  return { handleOnStart, handleOnSuccess, handleOnError };
};
