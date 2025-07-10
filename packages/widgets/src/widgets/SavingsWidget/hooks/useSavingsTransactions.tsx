import {
  Token,
  useBatchSavingsSupply,
  useBatchUpgradeAndSavingsSupply,
  useSavingsApprove,
  useSavingsSupply,
  useSavingsWithdraw
} from '@jetstreamgg/sky-hooks';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useContext } from 'react';
import { SavingsAction, SavingsFlow } from '../lib/constants';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { useSavingsTransactionCallbacks } from './useSavingsTransactionCallbacks';

interface UseSavingsTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  amount: bigint;
  max: boolean;
  referralCode: number | undefined;
  allowance: bigint | undefined;
  originToken: Token;
  mutateAllowance: () => void;
  mutateSavings: () => void;
  mutateOriginBalance: () => void;
}

export const useSavingsTransactions = ({
  amount,
  max,
  referralCode,
  allowance,
  originToken,
  mutateAllowance,
  mutateSavings,
  mutateOriginBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseSavingsTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const { approveTransactionCallbacks, supplyTransactionCallbacks, withdrawTransactionCallbacks } =
    useSavingsTransactionCallbacks({
      amount,
      mutateAllowance,
      mutateOriginBalance,
      mutateSavings,
      retryPrepareSupply: () => savingsSupply.retryPrepare(),
      addRecentTransaction,
      onWidgetStateChange,
      onNotification
    });

  const savingsApprove = useSavingsApprove({
    amount,
    enabled: widgetState.action === SavingsAction.APPROVE && allowance !== undefined,
    ...approveTransactionCallbacks
  });

  const savingsSupplyParams = {
    amount,
    ref: referralCode,
    ...supplyTransactionCallbacks
  };

  const savingsSupply = useSavingsSupply({
    ...savingsSupplyParams,
    enabled: widgetState.action === SavingsAction.SUPPLY && allowance !== undefined
  });

  const batchSavingsSupply = useBatchSavingsSupply({
    ...savingsSupplyParams,
    enabled:
      (widgetState.action === SavingsAction.SUPPLY || widgetState.action === SavingsAction.APPROVE) &&
      allowance !== undefined
  });

  const savingsWithdraw = useSavingsWithdraw({
    amount,
    max,
    enabled: widgetState.action === SavingsAction.WITHDRAW,
    ...withdrawTransactionCallbacks
  });

  const batchUpgradeAndSupply = useBatchUpgradeAndSavingsSupply({
    ...savingsSupplyParams,
    enabled: widgetState.flow === SavingsFlow.SUPPLY && originToken.symbol === 'DAI'
  });

  return { savingsApprove, savingsSupply, batchSavingsSupply, savingsWithdraw, batchUpgradeAndSupply };
};
