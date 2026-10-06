import { isSettled } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';

const KEY_PREFIX = 'bridgePending:v1:';
const SETTLED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const STATUSES = new Set(['pending', 'ready', 'arrived', 'claimed', 'failed']);
const ROUTE_KINDS = new Set(['native', 'cctp', 'layerzero']);

type Listener = () => void;

/**
 * One list per account and chain family (mainnet or the Tenderly fork), not
 * per network: a Safe that bridged from Base sees the bridge on Ethereum too.
 */
export const pendingScopeKey = ({ account, familyChainId }: { account: string; familyChainId: number }) =>
  `${familyChainId}:${account.toLowerCase()}`;

const storageKey = (scope: string) => `${KEY_PREFIX}${scope}`;

const parseEntry = (value: unknown): PendingBridge | null => {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (
    typeof entry.id !== 'string' ||
    typeof entry.account !== 'string' ||
    typeof entry.amount !== 'string' ||
    typeof entry.from !== 'string' ||
    typeof entry.to !== 'string' ||
    !STATUSES.has(entry.status as string) ||
    !ROUTE_KINDS.has(entry.routeKind as string) ||
    typeof entry.startedAt !== 'number' ||
    typeof entry.etaAt !== 'number' ||
    !Array.isArray(entry.actions)
  ) {
    return null;
  }
  try {
    return { ...(entry as unknown as PendingBridge), amount: BigInt(entry.amount) };
  } catch {
    return null;
  }
};

const serialize = (bridges: PendingBridge[]) =>
  JSON.stringify(bridges.map(bridge => ({ ...bridge, amount: bridge.amount.toString() })));

const byNewest = (a: PendingBridge, b: PendingBridge) => b.startedAt - a.startedAt;

const isSameBridge = (a: PendingBridge, b: PendingBridge) =>
  a.id === b.id || (!!a.safeTxHash && a.safeTxHash === b.safeTxHash) || (!!a.txHash && a.txHash === b.txHash);

/**
 * Pending bridges in localStorage, so they survive a reload and stay in sync
 * across tabs. Settled bridges are kept 90 days for the Activity list.
 */
export function createPendingBridgeStore({ now = Date.now }: { now?: () => number } = {}) {
  const listeners = new Set<Listener>();
  const snapshots = new Map<string, PendingBridge[]>();

  const read = (scope: string): PendingBridge[] => {
    try {
      const raw = localStorage.getItem(storageKey(scope));
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const cutoff = now() - SETTLED_RETENTION_MS;
      return parsed
        .map(parseEntry)
        .filter((bridge): bridge is PendingBridge => bridge !== null)
        .filter(bridge => !isSettled(bridge) || (bridge.settledAt ?? 0) > cutoff)
        .sort(byNewest);
    } catch {
      return [];
    }
  };

  const emit = () => listeners.forEach(listener => listener());

  const write = (scope: string, bridges: PendingBridge[]) => {
    const sorted = [...bridges].sort(byNewest);
    snapshots.set(scope, sorted);
    try {
      localStorage.setItem(storageKey(scope), serialize(sorted));
    } catch {
      // ignore storage write failures (private mode, quota); the session copy still updates
    }
    emit();
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(KEY_PREFIX)) return;
    snapshots.clear();
    emit();
  };

  const getSnapshot = (scope: string): PendingBridge[] => {
    let snapshot = snapshots.get(scope);
    if (!snapshot) {
      snapshot = read(scope);
      snapshots.set(scope, snapshot);
    }
    return snapshot;
  };

  return {
    subscribe(listener: Listener) {
      if (listeners.size === 0) window.addEventListener('storage', onStorage);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener('storage', onStorage);
      };
    },
    getSnapshot,
    /** Adds a bridge, or replaces the one with the same id, Safe tx hash or tx hash (keeping its id). */
    upsert(scope: string, bridge: PendingBridge) {
      const current = getSnapshot(scope);
      const existing = current.find(entry => isSameBridge(entry, bridge));
      write(
        scope,
        existing
          ? current.map(entry => (entry === existing ? { ...bridge, id: existing.id } : entry))
          : [bridge, ...current]
      );
    },
    update(scope: string, id: string, apply: (bridge: PendingBridge) => PendingBridge) {
      const current = getSnapshot(scope);
      const existing = current.find(entry => entry.id === id);
      if (!existing) return;
      const next = apply(existing);
      if (next === existing) return;
      write(
        scope,
        current.map(entry => (entry === existing ? next : entry))
      );
    }
  };
}

export type PendingBridgeStore = ReturnType<typeof createPendingBridgeStore>;

export const pendingBridgeStore = createPendingBridgeStore();
