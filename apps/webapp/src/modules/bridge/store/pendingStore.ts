import { BRIDGE_NETWORKS } from '../model/networks';
import { applyProgress, canDismiss, closeCard, isSettled } from '../model/pendingTransitions';
import type {
  BridgeRouteKind,
  PendingBridge,
  PendingBridgeNextAction,
  PendingBridgeStatus
} from '../model/types';
import { createScopedListStore } from './scopedListStore';

const KEY_PREFIX = 'bridgePending:v1:';
const SETTLED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

// Keyed by the types so a new status or action can't be left out: an entry with an unknown one is dropped on load.
const keysOf = (record: Record<string, true>) => new Set<unknown>(Object.keys(record));
const STATUSES = keysOf({
  pending: true,
  ready: true,
  arrived: true,
  claimed: true,
  failed: true,
  expired: true
} satisfies Record<PendingBridgeStatus, true>);
const ROUTE_KINDS = keysOf({ native: true, cctp: true, layerzero: true } satisfies Record<
  BridgeRouteKind,
  true
>);
const NETWORKS = new Set<unknown>(BRIDGE_NETWORKS.map(network => network.id));
const NEXT_ACTIONS = keysOf({
  claim: true,
  prove: true,
  finalize: true,
  redeem: true,
  replay: true,
  keepalive: true,
  convert: true
} satisfies Record<PendingBridgeNextAction, true>);

/**
 * One list per account and chain family (mainnet or the Tenderly fork), not
 * per network: a Safe that bridged from Base sees the bridge on Ethereum too.
 */
export const pendingScopeKey = ({ account, familyChainId }: { account: string; familyChainId: number }) =>
  `${familyChainId}:${account.toLowerCase()}`;

const isString = (value: unknown): value is string => typeof value === 'string';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);

const isAction = (value: unknown) =>
  isRecord(value) &&
  NEXT_ACTIONS.has(value.action) &&
  isString(value.txHash) &&
  typeof value.at === 'number' &&
  optional(value.status, status => status === 'sent' || status === 'invalidated') &&
  optional(value.safe, safe => safe === true) &&
  optional(value.bundle, bundle => bundle === true) &&
  optional(value.bundleTxHashes, hashes => Array.isArray(hashes) && hashes.every(isString)) &&
  optional(value.nextLegTxHash, isString);

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
    !STATUSES.has(entry.status) ||
    !ROUTE_KINDS.has(entry.routeKind) ||
    typeof entry.requiresClaim !== 'boolean' ||
    typeof entry.startedAt !== 'number' ||
    typeof entry.etaAt !== 'number' ||
    !Array.isArray(entry.actions) ||
    !entry.actions.every(isAction) ||
    !optional(entry.nextAction, action => NEXT_ACTIONS.has(action)) ||
    !optional(entry.txHash, isString) ||
    !optional(entry.safeTxHash, isString) ||
    !optional(entry.bundleId, isString) ||
    !optional(entry.callsId, isString) ||
    !optional(entry.recipient, isString) ||
    !optional(entry.routeData, data => isRecord(data) && Object.values(data).every(isString)) ||
    !optional(entry.readyAt, at => typeof at === 'number') ||
    !optional(entry.settledAt, at => typeof at === 'number') ||
    !optional(entry.closedAt, at => typeof at === 'number') ||
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
  const list = createScopedListStore<PendingBridge>({
    keyPrefix: KEY_PREFIX,
    parse: parseEntry,
    toJson: bridge => ({ ...bridge, amount: bridge.amount.toString() }),
    idOf: bridge => bridge.id,
    retain: bridge => !isSettled(bridge) || (bridge.settledAt ?? 0) > now() - SETTLED_RETENTION_MS,
    order: byNewest,
    isSame: isSameBridge
  });
  const { latest, write } = list;

  const update = (scope: string, id: string, apply: (bridge: PendingBridge) => PendingBridge) => {
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
  };

  return {
    subscribe: list.subscribe,
    getSnapshot: list.getSnapshot,
    /** Every account's scope with a list in this chain family, stored or only in this session. */
    scopesIn: (familyChainId: number): string[] => list.scopesStartingWith(`${familyChainId}:`),
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
     * Drops a bridge the user dismissed (see `canDismiss`); entries this bundle can't parse stay.
     * Checks the latest entry, so a bridge another tab saw execute is kept.
     */
    dismiss(scope: string, id: string) {
      const current = latest(scope);
      const existing = current.find(entry => entry.id === id);
      if (!existing || !canDismiss(existing, now())) return;
      write(
        scope,
        current.filter(entry => entry.id !== id),
        id
      );
    },
    /** Closes the card of a settled bridge with nothing left to confirm (see `closeCard`); Activity keeps it. */
    close(scope: string, id: string) {
      update(scope, id, bridge => closeCard(bridge, now()));
    },
    /**
     * Gives a wallet bundle's card the hash its deposit mined under, at `executedAt`
     * when known. Drops the card instead when another one already tracks that deposit.
     */
    resolveBundle(scope: string, id: string, txHash: string, executedAt?: number) {
      const current = latest(scope);
      const existing = current.find(entry => entry.id === id);
      if (!existing?.bundleId || existing.txHash || isSettled(existing)) return;
      const hash = txHash.toLowerCase();
      const tracked = current.some(
        entry =>
          entry !== existing && (entry.id.toLowerCase() === hash || entry.txHash?.toLowerCase() === hash)
      );
      if (tracked) {
        write(
          scope,
          current.filter(entry => entry !== existing),
          id
        );
        return;
      }
      const next = applyProgress(existing, { kind: 'source-executed', txHash, executedAt }, now());
      if (next === existing) return;
      write(
        scope,
        current.map(entry => (entry === existing ? next : entry)),
        id
      );
    },
    update
  };
}

export type PendingBridgeStore = ReturnType<typeof createPendingBridgeStore>;

export const pendingBridgeStore = createPendingBridgeStore();
