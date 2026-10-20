import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { isTracked, pollIntervalMs } from '../model/pendingTransitions';
import { bridgeChainId } from '../model/networks';
import { getBridgeAdapter } from '../adapters/registry';
import { readSafeActionProgress, readSafeTxProgress } from '../adapters/safe';
import { pendingBridgeStore } from '../store/pendingStore';
import { trackBridge } from '../tracking/trackBridge';
import { readsBalanceOn } from './balanceQueries';
import { wagmiAdapterContext } from './adapterContext';
import { useBridgeHistory } from './useBridgeHistory';
import { useIncomingCctpBridges } from './useIncomingCctpBridges';
import { usePendingScope } from './usePendingScope';

/**
 * Polls every active bridge of the connected account, on any page, so a
 * bridge keeps moving to ready or arrived while the user is elsewhere, and a
 * settled one while a convert it sent is unconfirmed. A CCTP bridge another
 * account of this browser sent to it is polled too, in the sender's list.
 */
export function useBridgeTracker() {
  const { scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const queryClient = useQueryClient();
  const context = wagmiAdapterContext(config, familyChainId);
  const own = useBridgeHistory();
  const incoming = useIncomingCctpBridges();
  const active = [...(scope ? own.map(bridge => ({ scope, bridge })) : []), ...incoming].filter(entry =>
    isTracked(entry.bridge)
  );

  useQueries({
    queries: active.map(({ scope, bridge }) => ({
      queryKey: ['bridge-progress', scope, bridge.id],
      queryFn: async () => {
        const progress = await trackBridge({
          store: pendingBridgeStore,
          scope,
          id: bridge.id,
          now: Date.now,
          getAdapter: entry => getBridgeAdapter(entry.routeKind),
          context,
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
        const destinationChainId = bridgeChainId(bridge.to, familyChainId);
        if (progress?.kind === 'arrived' && destinationChainId !== undefined)
          void queryClient.invalidateQueries({ predicate: readsBalanceOn(destinationChainId) });
        return progress?.kind ?? null;
      },
      // Read from the store, not the closure: the entry changes between polls.
      refetchInterval: () => {
        const current = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === bridge.id);
        return (current && pollIntervalMs(current, Date.now())) || false;
      },
      staleTime: 0,
      retry: false
    }))
  });
}
