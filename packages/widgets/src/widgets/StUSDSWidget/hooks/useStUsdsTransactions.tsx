import { useBatchStUsdsDeposit, useStUsdsWithdraw } from '@jetstreamgg/sky-hooks';
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
  mutateAllowance: () => void;
  mutateStUsds: () => void;
}

export const useStUsdsTransactions = ({
  amount,
  referralCode,
  max,
  shouldUseBatch,
  mutateAllowance,
  mutateStUsds,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseStUsdsTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const { supplyTransactionCallbacks, withdrawTransactionCallbacks } = useStUsdsTransactionCallbacks({
    amount,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification,
    mutateAllowance,
    mutateStUsds
  });

  const batchStUsdsDeposit = useBatchStUsdsDeposit({
    amount,
    referral: referralCode,
    shouldUseBatch,
    enabled: widgetState.action === StUSDSAction.SUPPLY || widgetState.action === StUSDSAction.APPROVE,
    ...supplyTransactionCallbacks
  });

  const stUsdsWithdraw = useStUsdsWithdraw({
    amount,
    max,
    enabled: widgetState.action === StUSDSAction.WITHDRAW,
    ...withdrawTransactionCallbacks
  });

  return { batchStUsdsDeposit, stUsdsWithdraw };
};
