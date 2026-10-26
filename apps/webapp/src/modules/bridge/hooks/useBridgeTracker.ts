import { useQueries, useQueryClient } from '@tanstack/react-query';
import { getCallsStatus } from '@wagmi/core';
import { useConfig } from 'wagmi';
import { isTracked, pollIntervalMs } from '../model/pendingTransitions';
import { bridgeChainId } from '../model/networks';
import { getBridgeAdapter } from '../adapters/registry';
import { readSafeActionProgress, readSafeTxProgress } from '../adapters/safe';
import { cctpSwapStore } from '../store/cctpSwapStore';
import { pendingBridgeStore } from '../store/pendingStore';
import { bundleActionProgress } from '../tracking/bundleAction';
import { trackBridge } from '../tracking/trackBridge';
import { readsBalanceOn } from './balanceQueries';
import { wagmiAdapterContext } from './adapterContext';
import { useBridgeHistory } from './useBridgeHistory';
import { useIncomingCctpBridges } from './useIncomingCctpBridges';
import { usePendingScope } from './usePendingScope';

const BURN_MINED = new Set(['waiting', 'ready', 'arrived', 'expired']);

/**
 * Polls every active bridge of the connected account, on any page, so a
 * bridge keeps moving to ready or arrived while the user is elsewhere, and a
 * settled one while an action it sent is unconfirmed. A CCTP bridge another
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
          },
          // Only the wallet that took the bundle knows it; one that can't answer leaves it sent.
          readBundleAction: async (_, sent) => {
            try {
              return bundleActionProgress(sent, await getCallsStatus(config, { id: sent.txHash }));
            } catch {
              return null;
            }
          }
        });
        // The burn mined: the swap it continued has nothing left to bridge.
        if (bridge.routeKind === 'cctp' && progress && BURN_MINED.has(progress.kind)) {
          const current = pendingBridgeStore.getSnapshot(scope).find(entry => entry.id === bridge.id);
          cctpSwapStore.clearBurned(scope, [bridge.id, current?.txHash, current?.callsId]);
        }
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
