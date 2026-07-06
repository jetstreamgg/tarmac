import { useCallback, useContext } from 'react';
import {
  WidgetProps,
  WidgetState,
  OnNotificationCallback,
  OnAnalyticsEventCallback
} from '../types/widgetState';
import { WidgetAnalyticsEventType } from '../types/analyticsEvents';
import { WidgetContext } from '@/widgets/context/WidgetContext';
import { getTransactionLink } from '@/utils';
import { useIsSafeWallet } from '@/hooks';
import { useConnection, useChainId } from 'wagmi';
import { InitialScreen, NotificationType, TxStatus } from '../constants';

type UseTransactionCallbacksParameters = Pick<WidgetProps, 'onWidgetStateChange'> & {
  onNotification?: OnNotificationCallback;
  onAnalyticsEvent?: OnAnalyticsEventCallback;
};

interface TransactionStartParameters {
  hash?: string;
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
  onWidgetStateChange,
  onNotification,
  onAnalyticsEvent
}: UseTransactionCallbacksParameters) => {
  const { widgetState, setWidgetState, setExternalLink, setTxStatus } = useContext(WidgetContext);

  const chainId = useChainId();
  const { address } = useConnection();
  const isSafeWallet = useIsSafeWallet();

  const handleOnMutate = useCallback(() => {
    setWidgetState((prev: WidgetState) => ({ ...prev, screen: InitialScreen.TRANSACTION }));
    setTxStatus(TxStatus.INITIALIZED);
    setExternalLink(undefined);

    try {
      onAnalyticsEvent?.({
        event: WidgetAnalyticsEventType.TRANSACTION_STARTED,
        action: widgetState.action,
        flow: widgetState.flow
      });
    } catch {
      // Analytics must never break functionality
    }
  }, [setWidgetState, setTxStatus, setExternalLink, onAnalyticsEvent, widgetState]);

  const handleOnStart = useCallback(
    ({ hash }: TransactionStartParameters) => {
      if (hash) {
        setExternalLink(getTransactionLink(chainId, address, hash, isSafeWallet));
      }
      setTxStatus(TxStatus.LOADING);
      onWidgetStateChange?.({ hash, widgetState, txStatus: TxStatus.LOADING });
    },
    [address, chainId, isSafeWallet, onWidgetStateChange, setExternalLink, setTxStatus, widgetState]
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

      try {
        onAnalyticsEvent?.({
          event: WidgetAnalyticsEventType.TRANSACTION_COMPLETED,
          action: widgetState.action,
          flow: widgetState.flow,
          txHash: hash
        });
      } catch {
        // Analytics must never break functionality
      }
    },
    [
      address,
      chainId,
      isSafeWallet,
      onNotification,
      onWidgetStateChange,
      onAnalyticsEvent,
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

      try {
        onAnalyticsEvent?.({
          event: WidgetAnalyticsEventType.TRANSACTION_ERROR,
          action: widgetState.action,
          flow: widgetState.flow,
          txHash: hash,
          error
        });
      } catch {
        // Analytics must never break functionality
      }
    },
    [
      address,
      chainId,
      isSafeWallet,
      onNotification,
      onWidgetStateChange,
      onAnalyticsEvent,
      setExternalLink,
      setTxStatus,
      widgetState
    ]
  );

  return { handleOnMutate, handleOnStart, handleOnSuccess, handleOnError };
};
