import {
  Token,
  TOKENS,
  useBatchSavingsSupply,
  useBatchUpgradeAndSavingsSupply,
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
  originToken: Token;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateSavings: () => void;
  mutateOriginBalance: () => void;
}

export const useSavingsTransactions = ({
  amount,
  max,
  referralCode,
  originToken,
  shouldUseBatch,
  mutateAllowance,
  mutateSavings,
  mutateOriginBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification
}: UseSavingsTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const { supplyTransactionCallbacks, withdrawTransactionCallbacks } = useSavingsTransactionCallbacks({
    amount,
    mutateAllowance,
    mutateSavings,
    mutateOriginBalance,
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

  const batchUpgradeAndSupply = useBatchUpgradeAndSavingsSupply({
    amount,
    ref: referralCode,
    // Always use batch transactions for this flow
    shouldUseBatch: true,
    enabled: widgetState.flow === SavingsFlow.SUPPLY && originToken.symbol === TOKENS.dai.symbol,
    ...supplyTransactionCallbacks
  });

  const savingsWithdraw = useSavingsWithdraw({
    amount,
    max,
    enabled: widgetState.action === SavingsAction.WITHDRAW,
    ...withdrawTransactionCallbacks
  });

  return { batchSavingsSupply, batchUpgradeAndSupply, savingsWithdraw };
};
