import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { usePendingScope } from './usePendingScope';

/** A bridge another account of this browser sent to the connected one, with the scope it's stored under. */
export type IncomingBridge = { scope: string; bridge: PendingBridge };

const NONE: IncomingBridge[] = [];

const sentTo = (bridge: PendingBridge, account: string) =>
  bridge.routeKind === 'cctp' && bridge.to === 'ethereum' && bridge.recipient?.toLowerCase() === account;

/**
 * CCTP bridges to Ethereum that another account sent from this browser to the
 * connected one, newest first: the claim and the conversion are the
 * recipient's, and are recorded on the sender's entry.
 */
export function useIncomingCctpBridges(): IncomingBridge[] {
  const { account, familyChainId, scope } = usePendingScope();
  // The lists the last result was read from: the same lists give the same result.
  const cache = useRef<{
    key: string | undefined;
    own: PendingBridge[] | undefined;
    lists: PendingBridge[][];
    result: IncomingBridge[];
  }>({ key: undefined, own: undefined, lists: [], result: NONE });
  const getSnapshot = useCallback(() => {
    if (!account || !scope) return NONE;
    const scopes = pendingBridgeStore.scopesIn(familyChainId).filter(other => other !== scope);
    const lists = scopes.map(other => pendingBridgeStore.getSnapshot(other));
    const own = pendingBridgeStore.getSnapshot(scope);
    const key = `${scope}|${scopes.join(',')}`;
    const cached = cache.current;
    if (
      cached.key === key &&
      cached.own === own &&
      cached.lists.every((list, index) => list === lists[index])
    )
      return cached.result;
    const lower = account.toLowerCase();
    // A burn added from its claim link is the wallet's own entry, claimed from there.
    const ownHashes = new Set(own.flatMap(bridge => (bridge.txHash ? [bridge.txHash.toLowerCase()] : [])));
    const found = scopes
      .flatMap((other, index) =>
        lists[index]
          .filter(bridge => sentTo(bridge, lower) && !ownHashes.has(bridge.txHash?.toLowerCase() ?? ''))
          .map(bridge => ({ scope: other, bridge }))
      )
      .sort((a, b) => b.bridge.startedAt - a.bridge.startedAt);
    const result = found.length === 0 ? NONE : found;
    cache.current = { key, own, lists, result };
    return result;
  }, [account, familyChainId, scope]);
  return useSyncExternalStore(pendingBridgeStore.subscribe, getSnapshot);
}
