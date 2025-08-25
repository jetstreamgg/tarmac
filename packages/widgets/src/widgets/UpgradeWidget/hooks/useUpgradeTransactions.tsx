import { useBatchUpgraderManager } from './useBatchUpgraderManager';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { Token } from '@jetstreamgg/sky-hooks';
import { useUpgradeTransactionCallbacks } from './useUpgradeTransactionCallbacks';

interface UseUpgradeTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  originToken: Token;
  targetToken: Token;
  originAmount: bigint;
  shouldUseBatch: boolean;
  shouldAllowExternalUpdate: React.RefObject<boolean>;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateTargetBalance: () => void;
  tabIndex: 0 | 1;
}

export const useUpgradeTransactions = ({
  originToken,
  targetToken,
  originAmount,
  shouldUseBatch,
  shouldAllowExternalUpdate,
  mutateAllowance,
  mutateOriginBalance,
  mutateTargetBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  tabIndex
}: UseUpgradeTransactionsParameters) => {
  const { upgradeManagerTransactionCallbacks } = useUpgradeTransactionCallbacks({
    originAmount,
    originToken,
    targetToken,
    tabIndex,
    shouldAllowExternalUpdate,
    mutateAllowance,
    mutateOriginBalance,
    mutateTargetBalance,
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const batchActionManager = useBatchUpgraderManager({
    token: originToken,
    amount: originAmount,
    shouldUseBatch,
    enabled: true,
    ...upgradeManagerTransactionCallbacks
  });

  return { batchActionManager };
};
