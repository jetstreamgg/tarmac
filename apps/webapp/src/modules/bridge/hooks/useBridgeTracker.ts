import { useQueries, useQueryClient, type Query } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { isSettled, pollIntervalMs } from '../model/pendingTransitions';
import { bridgeChainId } from '../model/networks';
import { getBridgeAdapter } from '../adapters/registry';
import { readSafeActionProgress, readSafeTxProgress } from '../adapters/safe';
import type { AdapterContext } from '../adapters/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { trackBridge } from '../tracking/trackBridge';
import { useBridgeHistory } from './useBridgeHistory';
import { usePendingScope } from './usePendingScope';

/** Token balance reads on a chain; a bridge that arrived there makes them stale. */
export const readsBalanceOn =
  (chainId: number) =>
  ({ queryKey }: Pick<Query, 'queryKey'>): boolean => {
    const [kind, params] = queryKey as [
      unknown,
      { contracts?: { chainId?: number; functionName?: string }[] }?
    ];
    return (
      kind === 'readContracts' &&
      !!params?.contracts?.some(read => read.chainId === chainId && read.functionName === 'balanceOf')
    );
  };

/**
 * Polls every active bridge of the connected account, on any page, so a
 * bridge keeps moving to ready or arrived while the user is elsewhere.
 */
export function useBridgeTracker() {
  const { scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const queryClient = useQueryClient();
  const context: AdapterContext = {
    getClient: network => {
      const chainId = bridgeChainId(network, familyChainId);
      return chainId === undefined ? undefined : getPublicClient(config, { chainId });
    }
  };
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
