import { useBatchSavingsSupply, useSavingsWithdraw } from '@jetstreamgg/sky-hooks';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useContext } from 'react';
import { SavingsAction } from '../lib/constants';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useSavingsTransactionCallbacks } from './useSavingsTransactionCallbacks';

interface UseSavingsTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amount: bigint;
  max: boolean;
  referralCode: number | undefined;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateSavings: () => void;
}

export const useSavingsTransactions = ({
  amount,
  max,
  referralCode,
  shouldUseBatch,
  mutateAllowance,
  mutateSavings,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseSavingsTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const { supplyTransactionCallbacks, withdrawTransactionCallbacks } = useSavingsTransactionCallbacks({
    amount,
    mutateAllowance,
    mutateSavings,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const batchSavingsSupply = useBatchSavingsSupply({
    amount,
    ref: referralCode,
    shouldUseBatch,
    enabled: widgetState.action === SavingsAction.SUPPLY || widgetState.action === SavingsAction.APPROVE,
    ...supplyTransactionCallbacks
  });

  const savingsWithdraw = useSavingsWithdraw({
    amount,
    max,
    enabled: widgetState.action === SavingsAction.WITHDRAW,
    ...withdrawTransactionCallbacks
  });

  return { batchSavingsSupply, savingsWithdraw };
};
