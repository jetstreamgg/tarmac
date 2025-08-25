import {
  useBatchStUsdsDeposit,
  useStUsdsApprove,
  useStUsdsDeposit,
  useStUsdsWithdraw
} from '@jetstreamgg/sky-hooks';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useContext } from 'react';
import { StUSDSAction } from '../lib/constants';
import { useStUsdsTransactionCallbacks } from './useStUsdsTransactionCallbacks';

interface UseStUsdsTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  allowance: bigint | undefined;
  amount: bigint;
  referralCode: number | undefined;
  max: boolean;
  mutateAllowance: () => void;
  mutateStUsds: () => void;
}

export const useStUsdsTransactions = ({
  allowance,
  amount,
  referralCode,
  max,
  mutateAllowance,
  mutateStUsds,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseStUsdsTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const { approveTransactionCallbacks, supplyTransactionCallbacks, withdrawTransactionCallbacks } =
    useStUsdsTransactionCallbacks({
      amount,
      addRecentTransaction,
      onWidgetStateChange,
      onNotification,
      mutateAllowance,
      mutateStUsds,
      retryPrepareDeposit: () => stUsdsDeposit.retryPrepare()
    });

  const stUsdsApprove = useStUsdsApprove({
    amount,
    enabled: widgetState.action === StUSDSAction.APPROVE && allowance !== undefined,
    ...approveTransactionCallbacks
  });

  const stUsdsDepositParams = {
    amount,
    referral: referralCode,
    ...supplyTransactionCallbacks
  };

  const stUsdsDeposit = useStUsdsDeposit({
    ...stUsdsDepositParams,
    enabled: widgetState.action === StUSDSAction.SUPPLY && allowance !== undefined
  });

  const batchStUsdsDeposit = useBatchStUsdsDeposit({
    ...stUsdsDepositParams,
    enabled:
      (widgetState.action === StUSDSAction.SUPPLY || widgetState.action === StUSDSAction.APPROVE) &&
      allowance !== undefined
  });

  const stUsdsWithdraw = useStUsdsWithdraw({
    amount,
    max,
    enabled: widgetState.action === StUSDSAction.WITHDRAW,
    ...withdrawTransactionCallbacks
  });

  return {
    stUsdsApprove,
    stUsdsDeposit,
    batchStUsdsDeposit,
    stUsdsWithdraw
  };
};
