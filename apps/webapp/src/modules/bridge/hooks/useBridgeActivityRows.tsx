import { useMemo } from 'react';
import type { ExtraActivityRow } from '@/modules/app/shell/activity/mergeActivityRows';
import { buildBridgeActivity } from '../components/bridgeActivity';
import { BridgeActivityItem } from '../components/BridgeActivityItem';
import { useBridgeHistory } from './useBridgeHistory';
import { usePendingScope } from './usePendingScope';

/** Bridge / Funds claim rows (Figma Wallet Activity 3574:64437), styled as BalancesHistoryItem, for the Activity feed. */
export function useBridgeActivityRows(): ExtraActivityRow[] {
  const history = useBridgeHistory();
  const { familyChainId } = usePendingScope();
  return useMemo(
    () =>
      buildBridgeActivity(history).map(entry => ({
        key: entry.id,
        timestamp: entry.timestamp,
        render: () => <BridgeActivityItem entry={entry} familyChainId={familyChainId} />
      })),
    [history, familyChainId]
  );
}
