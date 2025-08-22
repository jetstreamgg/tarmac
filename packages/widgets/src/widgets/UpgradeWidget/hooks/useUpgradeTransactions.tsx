import { useApproveManager } from './useApproveManager';
import { useUpgraderManager } from './useUpgraderManager';
import { useBatchUpgraderManager } from './useBatchUpgraderManager';
import { WidgetContext } from '@widgets/context/WidgetContext';
import { useContext } from 'react';
import { UpgradeAction } from '../lib/constants';
import { WidgetProps } from '@widgets/shared/types/widgetState';
import { Token } from '@jetstreamgg/sky-hooks';
import { useUpgradeTransactionCallbacks } from './useUpgradeTransactionCallbacks';

interface UseUpgradeTransactionsParameters
  extends Pick<WidgetProps, 'addRecentTransaction' | 'onWidgetStateChange' | 'onNotification'> {
  originToken: Token;
  targetToken: Token;
  originAmount: bigint;
  allowance: bigint | undefined;
  shouldUseBatch: boolean;
  mutateAllowance: () => void;
  mutateOriginBalance: () => void;
  mutateTargetBalance: () => void;
  tabIndex: 0 | 1;
}

export const useUpgradeTransactions = ({
  originToken,
  targetToken,
  originAmount,
  allowance,
  shouldUseBatch,
  mutateAllowance,
  mutateOriginBalance,
  mutateTargetBalance,
  addRecentTransaction,
  onWidgetStateChange,
  onNotification,
  tabIndex
}: UseUpgradeTransactionsParameters) => {
  const { widgetState } = useContext(WidgetContext);
  const { approveTransactionCallbacks, upgradeManagerTransactionCallbacks } = useUpgradeTransactionCallbacks({
    originAmount,
    originToken,
    targetToken,
    tabIndex,
    mutateAllowance,
    mutateOriginBalance,
    mutateTargetBalance,
    retryPrepareAction: () => actionManager.retryPrepare(),
    addRecentTransaction,
    onWidgetStateChange,
    onNotification
  });

  const approve = useApproveManager({
    amount: originAmount,
    token: originToken,
    enabled: widgetState.action === UpgradeAction.APPROVE && allowance !== undefined,
    ...approveTransactionCallbacks
  });

  const actionManager = useUpgraderManager({
    token: originToken,
    amount: originAmount,
    enabled:
      (widgetState.action === UpgradeAction.UPGRADE || widgetState.action === UpgradeAction.REVERT) &&
      allowance !== undefined,
    ...upgradeManagerTransactionCallbacks
  });

  const batchActionManager = useBatchUpgraderManager({
    token: originToken,
    amount: originAmount,
    // Only enable batch flow when the user needs allowance, otherwise default to individual Upgrade/Revert transaction
    enabled: shouldUseBatch,
    ...upgradeManagerTransactionCallbacks
  });

  return { approve, actionManager, batchActionManager };
};
