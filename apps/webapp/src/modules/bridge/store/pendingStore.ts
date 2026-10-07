import { BRIDGE_NETWORKS } from '../model/networks';
import { canDismiss, isSettled } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';

const KEY_PREFIX = 'bridgePending:v1:';
const SETTLED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const STATUSES = new Set(['pending', 'ready', 'arrived', 'claimed', 'failed']);
const ROUTE_KINDS = new Set(['native', 'cctp', 'layerzero']);
const NETWORKS = new Set<unknown>(BRIDGE_NETWORKS.map(network => network.id));
const NEXT_ACTIONS = new Set<unknown>(['claim', 'prove', 'finalize']);

type Listener = () => void;

/**
 * One list per account and chain family (mainnet or the Tenderly fork), not
 * per network: a Safe that bridged from Base sees the bridge on Ethereum too.
 */
export const pendingScopeKey = ({ account, familyChainId }: { account: string; familyChainId: number }) =>
  `${familyChainId}:${account.toLowerCase()}`;

const storageKey = (scope: string) => `${KEY_PREFIX}${scope}`;

const isString = (value: unknown): value is string => typeof value === 'string';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);

const isAction = (value: unknown) =>
  isRecord(value) &&
  NEXT_ACTIONS.has(value.action) &&
  isString(value.txHash) &&
  typeof value.at === 'number' &&
  optional(value.status, status => status === 'sent' || status === 'invalidated');

const parseEntry = (value: unknown): PendingBridge | null => {
  if (!isRecord(value)) return null;
  const entry = value;
  if (
    !isString(entry.id) ||
    !isString(entry.account) ||
    !isString(entry.amount) ||
    entry.token !== 'USDS' ||
    !NETWORKS.has(entry.from) ||
    !NETWORKS.has(entry.to) ||
    !STATUSES.has(entry.status as string) ||
    !ROUTE_KINDS.has(entry.routeKind as string) ||
    typeof entry.requiresClaim !== 'boolean' ||
    typeof entry.startedAt !== 'number' ||
    typeof entry.etaAt !== 'number' ||
    !Array.isArray(entry.actions) ||
    !entry.actions.every(isAction) ||
    !optional(entry.nextAction, action => NEXT_ACTIONS.has(action)) ||
    !optional(entry.txHash, isString) ||
    !optional(entry.safeTxHash, isString) ||
    !optional(entry.recipient, isString) ||
    !optional(entry.routeData, data => isRecord(data) && Object.values(data).every(isString)) ||
    !optional(entry.settledAt, at => typeof at === 'number') ||
    !optional(entry.failureReason, isString)
  ) {
    return null;
  }
  try {
    return { ...(entry as unknown as PendingBridge), amount: BigInt(entry.amount) };
  } catch {
    return null;
  }
};

const serialize = (bridges: PendingBridge[], kept: unknown[]) =>
  JSON.stringify([...bridges.map(bridge => ({ ...bridge, amount: bridge.amount.toString() })), ...kept]);

/**
 * What a write must carry over from storage: entries this bundle can't parse
 * (a newer one may have written them). An unreadable value is copied once to
 * `<key>:unreadable` first; if that copy fails, this throws and nothing is replaced.
 */
const unparsedEntries = (key: string): unknown[] => {
  const raw = localStorage.getItem(key);
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (Array.isArray(parsed)) return parsed.filter(entry => parseEntry(entry) === null);
  if (localStorage.getItem(`${key}:unreadable`) === null) localStorage.setItem(`${key}:unreadable`, raw);
  return [];
};

const byNewest = (a: PendingBridge, b: PendingBridge) => b.startedAt - a.startedAt;

const isSameBridge = (a: PendingBridge, b: PendingBridge) =>
  a.id === b.id || (!!a.safeTxHash && a.safeTxHash === b.safeTxHash) || (!!a.txHash && a.txHash === b.txHash);

/** The stored entry wins; the incoming one only fills what it lacks (a Safe bridge's tx hash). */
const fillMissing = (existing: PendingBridge, incoming: PendingBridge): PendingBridge => ({
  ...incoming,
  ...(Object.fromEntries(
    Object.entries(existing).filter(([, value]) => value !== undefined)
  ) as PendingBridge)
});

/**
 * Pending bridges in localStorage, so they survive a reload and stay in sync
 * across tabs. Settled bridges are kept 90 days for the Activity list.
 */
export function createPendingBridgeStore({ now = Date.now }: { now?: () => number } = {}) {
  const listeners = new Set<Listener>();
  const snapshots = new Map<string, PendingBridge[]>();

  // Bridges whose last change reached only this session's copy (a write failed), by scope.
  const unsaved = new Map<string, Set<string>>();

  /** The stored list; undefined when storage can't be read. */
  const load = (scope: string): PendingBridge[] | undefined => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(storageKey(scope));
    } catch {
      return undefined;
    }
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
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
  const read = (scope: string): PendingBridge[] => load(scope) ?? [];

  const emit = () => listeners.forEach(listener => listener());

  /** The stored list with this session's unsaved changes on top: added, updated or dropped. */
  const withUnsaved = (scope: string, stored: PendingBridge[]): PendingBridge[] => {
    const ids = unsaved.get(scope);
    if (!ids) return stored;
    const own = (snapshots.get(scope) ?? []).filter(entry => ids.has(entry.id));
    return [
      ...own,
      ...stored.filter(entry => !ids.has(entry.id) && !own.some(mine => isSameBridge(mine, entry)))
    ].sort(byNewest);
  };

  const write = (scope: string, bridges: PendingBridge[], changedId: string) => {
    const sorted = [...bridges].sort(byNewest);
    snapshots.set(scope, sorted);
    try {
      const key = storageKey(scope);
      localStorage.setItem(key, serialize(sorted, unparsedEntries(key)));
      unsaved.delete(scope);
    } catch {
      // ignore storage write failures (private mode, quota); the session copy still updates
      unsaved.set(scope, new Set(unsaved.get(scope)).add(changedId));
    }
    emit();
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && !event.key.startsWith(KEY_PREFIX)) return;
    snapshots.forEach((_, scope) => {
      if (!unsaved.has(scope)) {
        snapshots.delete(scope);
        return;
      }
      const stored = load(scope);
      if (stored) snapshots.set(scope, withUnsaved(scope, stored));
    });
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

  // Writes start from storage, not this tab's copy, so another tab's write is not lost.
  const latest = (scope: string): PendingBridge[] => {
    const stored = load(scope);
    return stored ? withUnsaved(scope, stored) : getSnapshot(scope);
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
    /** Adds a bridge, or fills the gaps of the one with the same id, Safe tx hash or tx hash. */
    upsert(scope: string, bridge: PendingBridge) {
      const current = latest(scope);
      const existing = current.find(entry => isSameBridge(entry, bridge));
      write(
        scope,
        existing
          ? current.map(entry => (entry === existing ? fillMissing(existing, bridge) : entry))
          : [bridge, ...current],
        existing?.id ?? bridge.id
      );
    },
    /**
     * Drops a queued Safe bridge the user dismissed; entries this bundle can't parse stay.
     * Checks the latest entry, so a bridge another tab saw execute is kept.
     */
    dismiss(scope: string, id: string) {
      const current = latest(scope);
      const existing = current.find(entry => entry.id === id);
      if (!existing || !canDismiss(existing)) return;
      write(
        scope,
        current.filter(entry => entry.id !== id),
        id
      );
    },
    update(scope: string, id: string, apply: (bridge: PendingBridge) => PendingBridge) {
      const current = latest(scope);
      const existing = current.find(entry => entry.id === id);
      if (!existing) return;
      const next = apply(existing);
      if (next === existing) return;
      write(
        scope,
        current.map(entry => (entry === existing ? next : entry)),
        id
      );
    }
  };
}

export type PendingBridgeStore = ReturnType<typeof createPendingBridgeStore>;

export const pendingBridgeStore = createPendingBridgeStore();
