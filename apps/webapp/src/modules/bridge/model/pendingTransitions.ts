import type { BridgeNetworkId } from './networks';
import { destinationActions } from './resolveRoute';
import type { BridgeRoute, PendingBridge, PendingBridgeAction, PendingBridgeNextAction } from './types';

const MINUTE = 60_000;
const SETTLED_VISIBLE_MS = 24 * 60 * MINUTE;
const FAST_POLL_MS = 15_000;
const READY_POLL_MS = MINUTE;
const SLOW_POLL_MS = 5 * MINUTE;
const FAST_POLL_WINDOW_MS = 60 * MINUTE;

/** What a route adapter observed about a bridge on one poll. */
export type BridgeProgress =
  /** The queued Safe transaction executed on-chain, at `executedAt` when the service says. */
  | { kind: 'source-executed'; txHash: string; executedAt?: number }
  | {
      kind: 'waiting';
      etaAt?: number;
      nextAction?: PendingBridgeNextAction;
      routeData?: Record<string, string>;
    }
  | { kind: 'ready'; nextAction: PendingBridgeNextAction; routeData?: Record<string, string> }
  /** Funds landed, automatically or through an action someone else sent. */
  | { kind: 'arrived' }
  | { kind: 'failed'; reason: string };

export const isSettled = (bridge: PendingBridge): boolean =>
  bridge.status === 'arrived' || bridge.status === 'claimed' || bridge.status === 'failed';

export function createPendingBridge({
  account,
  amount,
  from,
  to,
  recipient,
  route,
  txHash,
  safeTxHash,
  now
}: {
  account: string;
  amount: bigint;
  from: BridgeNetworkId;
  to: BridgeNetworkId;
  recipient?: string;
  route: BridgeRoute;
  txHash?: string;
  safeTxHash?: string;
  now: number;
}): PendingBridge {
  const id = txHash ?? safeTxHash;
  if (!id) throw new Error('A pending bridge needs a tx hash or a Safe tx hash');
  return {
    id,
    account: account.toLowerCase(),
    amount,
    token: 'USDS',
    from,
    to,
    ...(recipient && { recipient }),
    status: 'pending',
    routeKind: route.kind,
    requiresClaim: route.requiresClaim,
    nextAction: destinationActions(route.kind, from)[0],
    startedAt: now,
    etaAt: now + route.etaMinutes * MINUTE,
    ...(txHash && { txHash }),
    ...(safeTxHash && { safeTxHash }),
    actions: []
  };
}

const mergeRouteData = (bridge: PendingBridge, routeData: Record<string, string> | undefined) =>
  routeData ? { ...bridge.routeData, ...routeData } : bridge.routeData;

export function applyProgress(bridge: PendingBridge, progress: BridgeProgress, now: number): PendingBridge {
  if (isSettled(bridge)) return bridge;
  switch (progress.kind) {
    case 'source-executed': {
      // The launch and the tracker can both report it; the first one set the clock.
      if (bridge.txHash) return bridge;
      // The bridge starts when the Safe executes, which can be days after it was queued.
      const startedAt = progress.executedAt ?? now;
      return {
        ...bridge,
        txHash: progress.txHash,
        startedAt,
        etaAt: startedAt + bridge.etaAt - bridge.startedAt
      };
    }
    case 'waiting':
      return {
        ...bridge,
        status: 'pending',
        etaAt: progress.etaAt ?? bridge.etaAt,
        nextAction: progress.nextAction ?? bridge.nextAction,
        routeData: mergeRouteData(bridge, progress.routeData)
      };
    case 'ready':
      return {
        ...bridge,
        status: 'ready',
        nextAction: progress.nextAction,
        routeData: mergeRouteData(bridge, progress.routeData)
      };
    case 'arrived':
      return {
        ...bridge,
        status: bridge.requiresClaim ? 'claimed' : 'arrived',
        nextAction: undefined,
        settledAt: now
      };
    case 'failed':
      return { ...bridge, status: 'failed', failureReason: progress.reason, settledAt: now };
  }
}

/** A destination action the user sent and the transaction flow confirmed. */
export function recordAction(bridge: PendingBridge, action: PendingBridgeAction): PendingBridge {
  if (bridge.actions.some(sent => sent.txHash === action.txHash)) return bridge;
  const actions = [...bridge.actions, action];
  if (isSettled(bridge)) return { ...bridge, actions };
  const remaining = destinationActions(bridge.routeKind, bridge.from);
  const next = remaining[remaining.indexOf(action.action) + 1];
  return next
    ? { ...bridge, actions, status: 'pending', nextAction: next }
    : { ...bridge, actions, status: 'claimed', nextAction: undefined, settledAt: action.at };
}

/** Active bridges always show; settled ones stay for a day. */
export const isPendingBridgeVisible = (bridge: PendingBridge, now: number): boolean =>
  !isSettled(bridge) || now - (bridge.settledAt ?? 0) <= SETTLED_VISIBLE_MS;

/** How often the tracker checks a bridge; undefined once settled. */
export function pollIntervalMs(bridge: PendingBridge, now: number): number | undefined {
  if (isSettled(bridge)) return undefined;
  // A queued Safe transaction: signers usually act soon, but can take days.
  if (!bridge.txHash) return now - bridge.startedAt <= FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
  // Anyone can send the next action, so a ready bridge can still settle without us.
  if (bridge.status === 'ready') return READY_POLL_MS;
  return bridge.etaAt - now <= FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
}
