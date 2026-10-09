import { useQueries } from '@tanstack/react-query';
import { isSettled, pollIntervalMs } from '../model/pendingTransitions';
import { bridgeChainId } from '../model/networks';
import { getBridgeAdapter } from '../adapters/registry';
import { readSafeActionProgress, readSafeTxProgress } from '../adapters/safe';
import { pendingBridgeStore } from '../store/pendingStore';
import { trackBridge } from '../tracking/trackBridge';
import { useBridgeHistory } from './useBridgeHistory';
import { usePendingScope } from './usePendingScope';

/**
 * Polls every active bridge of the connected account, on any page, so a
 * bridge keeps moving to ready or arrived while the user is elsewhere.
 */
export function useBridgeTracker() {
  const { scope, familyChainId } = usePendingScope();
  const active = useBridgeHistory().filter(bridge => !isSettled(bridge));

  useQueries({
    queries: active.map(bridge => ({
      queryKey: ['bridge-progress', scope, bridge.id],
      queryFn: async () => {
        if (!scope) return null;
        const progress = await trackBridge({
          store: pendingBridgeStore,
          scope,
          id: bridge.id,
          now: Date.now,
          getAdapter: entry => getBridgeAdapter(entry.routeKind),
          readSafeTx: async entry => {
            const chainId = bridgeChainId(entry.from, familyChainId);
            return chainId === undefined
              ? null
              : readSafeTxProgress({ chainId, safeTxHash: entry.safeTxHash });
          },
          // Destination actions run on the destination network.
          readSafeAction: async (entry, sent) => {
            const chainId = bridgeChainId(entry.to, familyChainId);
            return chainId === undefined ? null : readSafeActionProgress({ chainId, sent, now: Date.now() });
          }
        });
        return progress?.kind ?? null;
      },
      enabled: !!scope,
      // Read from the store, not the closure: the entry changes between polls.
      refetchInterval: () => {
        const current = scope && pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === bridge.id);
        return (current && pollIntervalMs(current, Date.now())) || false;
      },
      staleTime: 0,
      retry: false
    }))
  });
}
