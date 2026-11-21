import { useQueries } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { useConfig } from 'wagmi';
import { dismissedSourceStore, type DismissedBridge } from '../store/dismissedSourceStore';
import { pendingBridgeStore } from '../store/pendingStore';
import { reviveDismissed } from '../tracking/dismissedSources';
import { wagmiAdapterContext } from './adapterContext';
import { usePendingScope } from './usePendingScope';

const WATCH_POLL_MS = 10 * 60_000;
const NONE: DismissedBridge[] = [];

/** Looks for the sends of the connected account's dismissed not-found cards, on any page, bringing back each one that shows up. */
export function useDismissedSourceWatch() {
  const { scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const context = wagmiAdapterContext(config, familyChainId);
  const getSnapshot = useCallback(() => (scope ? dismissedSourceStore.getSnapshot(scope) : NONE), [scope]);
  const dismissed = useSyncExternalStore(dismissedSourceStore.subscribe, getSnapshot);

  useQueries({
    queries: dismissed.map(entry => ({
      queryKey: ['bridge-dismissed-source', scope, entry.bridge.id],
      queryFn: () =>
        scope
          ? reviveDismissed({
              entry,
              scope,
              store: pendingBridgeStore,
              dismissed: dismissedSourceStore,
              context
            })
          : false,
      refetchInterval: WATCH_POLL_MS,
      refetchOnWindowFocus: false,
      staleTime: 0,
      retry: false
    }))
  });
}
