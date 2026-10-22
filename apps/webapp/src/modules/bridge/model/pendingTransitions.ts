import type { BridgeNetworkId } from './networks';
import {
  destinationActions,
  followUpActions,
  isFollowUpAction,
  isRecoveryAction,
  recoveryActions
} from './resolveRoute';
import type { BridgeRoute, PendingBridge, PendingBridgeAction, PendingBridgeNextAction } from './types';

const MINUTE = 60_000;
const SETTLED_VISIBLE_MS = 24 * 60 * MINUTE;
const FAST_POLL_MS = 15_000;
const READY_POLL_MS = MINUTE;
const OVERDUE_POLL_MS = MINUTE;
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
  /** The Arbitrum ticket is gone without a successful redeem (expired or canceled): nothing was delivered. */
  | { kind: 'expired' }
  /** The source send moved no funds (reverted, or a Safe tx replaced); Activity leaves it out. */
  | { kind: 'failed'; reason: string }
  /** A sent destination action mined, read from chain (a Safe reports its on-chain hash). */
  | { kind: 'action-confirmed'; action: PendingBridgeNextAction; txHash: string; at?: number }
  /** A sent destination action that will never land (reverted, replaced, rejected), by the hash it was sent with. */
  | { kind: 'action-dropped'; txHash: string }
  /** A confirmed action the chain no longer counts, so it must be sent again (an OP re-prove). */
  | { kind: 'action-invalidated'; action: PendingBridgeNextAction };

export const isSettled = (bridge: PendingBridge): boolean =>
  bridge.status === 'arrived' ||
  bridge.status === 'claimed' ||
  bridge.status === 'failed' ||
  bridge.status === 'expired';

/** Every action a bridge can record: its ordered destination steps, its recovery actions, then its follow-ups. */
const bridgeActions = (bridge: PendingBridge): PendingBridgeNextAction[] => [
  ...destinationActions(bridge.routeKind, bridge.from),
  ...recoveryActions(bridge.routeKind, bridge.from, bridge.to),
  ...followUpActions(bridge.routeKind, bridge.from, bridge.to)
];

export function createPendingBridge({
  account,
  amount,
  from,
  to,
  recipient,
  route,
  txHash,
  safeTxHash,
  bundleId,
  callsId,
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
  bundleId?: string;
  callsId?: string;
  now: number;
}): PendingBridge {
  const id = txHash ?? safeTxHash ?? bundleId;
  if (!id) throw new Error('A pending bridge needs a tx hash, a Safe tx hash or a bundle id');
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
    ...(bundleId && { bundleId }),
    ...(callsId && { callsId }),
    actions: []
  };
}

// A recovery action can be needed again after it mined (its L2 execution failed once more), so only the chain settles it.
const isConfirmed = (bridge: PendingBridge, action: PendingBridgeNextAction | undefined) =>
  !!action &&
  !isRecoveryAction(action) &&
  bridge.actions.some(done => done.action === action && done.status === undefined);

const mergeRouteData = (bridge: PendingBridge, routeData: Record<string, string> | undefined) =>
  routeData ? { ...bridge.routeData, ...routeData } : bridge.routeData;

export function applyProgress(bridge: PendingBridge, progress: BridgeProgress, now: number): PendingBridge {
  // Actions are read after arrival too, so Activity keeps the claim.
  if (progress.kind === 'action-confirmed') {
    return recordAction(bridge, { action: progress.action, txHash: progress.txHash, at: progress.at ?? now });
  }
  if (progress.kind === 'action-dropped') return dropSentAction(bridge, progress.txHash);
  if (isSettled(bridge)) return bridge;
  if (progress.kind === 'action-invalidated') return invalidateAction(bridge, progress.action);
  // A lagging read can still report an action this bridge already confirmed.
  if (
    (progress.kind === 'waiting' || progress.kind === 'ready') &&
    isConfirmed(bridge, progress.nextAction)
  ) {
    return bridge;
  }
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
        readyAt: bridge.status === 'ready' ? bridge.readyAt : now,
        routeData: mergeRouteData(bridge, progress.routeData)
      };
    case 'arrived':
      return {
        ...bridge,
        status: bridge.requiresClaim ? 'claimed' : 'arrived',
        nextAction: undefined,
        settledAt: now
      };
    case 'expired':
      return { ...bridge, status: 'expired', nextAction: undefined, settledAt: now };
    case 'failed':
      return { ...bridge, status: 'failed', failureReason: progress.reason, settledAt: now };
  }
}

const isSent = (action: PendingBridgeAction) => action.status === 'sent';

/** A destination action broadcast but not yet confirmed: it blocks a second launch, not the bridge's progress. */
export function recordActionSent(bridge: PendingBridge, action: PendingBridgeAction): PendingBridge {
  if (!bridgeActions(bridge).includes(action.action)) return bridge;
  if (bridge.actions.some(sent => sent.txHash === action.txHash)) return bridge;
  return { ...bridge, actions: [...bridge.actions, { ...action, status: 'sent' }] };
}

/** Removes a sent action whose transaction reverted; confirmed actions stay. */
export function dropSentAction(bridge: PendingBridge, txHash: string): PendingBridge {
  const actions = bridge.actions.filter(sent => !(isSent(sent) && sent.txHash === txHash));
  return actions.length === bridge.actions.length ? bridge : { ...bridge, actions };
}

/** The chain no longer counts the action: it is offered again, and the mined one stays in the history. */
function invalidateAction(bridge: PendingBridge, action: PendingBridgeNextAction): PendingBridge {
  if (!isConfirmed(bridge, action)) return bridge;
  return {
    ...bridge,
    status: 'pending',
    nextAction: action,
    actions: bridge.actions.map(done =>
      done.action === action && done.status === undefined ? { ...done, status: 'invalidated' } : done
    )
  };
}

/** The next action can be launched: it is ready and not already sent. */
export const canLaunchAction = (bridge: PendingBridge): boolean =>
  bridge.status === 'ready' &&
  !!bridge.nextAction &&
  !bridge.actions.some(sent => isSent(sent) && sent.action === bridge.nextAction);

/** The landed USDC of a CCTP transfer to Ethereum can be sold for USDS, once: none sent nor confirmed. */
export const canLaunchConvert = (bridge: PendingBridge): boolean =>
  followUpActions(bridge.routeKind, bridge.from, bridge.to).includes('convert') &&
  (bridge.status === 'claimed' || bridge.status === 'arrived') &&
  !bridge.actions.some(action => action.action === 'convert');

/** Under this an Arbitrum redeem is urgent and its ticket can be kept alive: a Safe's signers need time too. */
export const REDEEM_URGENT_MINUTES = 48 * 60;

const ticketTimeoutMs = (timeout: string | undefined) =>
  timeout && /^\d{1,15}$/.test(timeout) ? Number(timeout) * 1000 : undefined;

/** Whole minutes until a ready Arbitrum redeem's ticket times out, floored, 0 once it passed; undefined when unknown. */
export function ticketMinutesLeft(bridge: PendingBridge, now: number): number | undefined {
  if (bridge.routeKind !== 'native' || bridge.from !== 'ethereum' || bridge.to !== 'arbitrum')
    return undefined;
  if (bridge.status !== 'ready' || bridge.nextAction !== 'redeem') return undefined;
  const timeoutMs = ticketTimeoutMs(bridge.routeData?.timeout);
  return timeoutMs === undefined ? undefined : Math.max(0, Math.floor((timeoutMs - now) / 60_000));
}

/** The ticket can be kept alive: urgent, not yet timed out, and no redeem or keepalive in flight. */
export function canLaunchKeepalive(bridge: PendingBridge, now: number): boolean {
  const minutesLeft = ticketMinutesLeft(bridge, now);
  return (
    minutesLeft !== undefined &&
    minutesLeft > 0 &&
    minutesLeft < REDEEM_URGENT_MINUTES &&
    !bridge.actions.some(sent => isSent(sent) && (sent.action === 'keepalive' || sent.action === 'redeem'))
  );
}

/** The card shows the next action's button: always for a claim route, only once ready for a recovery. */
export const showsActionButton = (bridge: PendingBridge): boolean =>
  !isSettled(bridge) &&
  !!bridge.nextAction &&
  (isRecoveryAction(bridge.nextAction) ? bridge.status === 'ready' : bridge.requiresClaim);

/** After this a wallet bundle with no deposit found on chain may be dismissed. */
export const BUNDLE_UNSEEN_MS = 30 * MINUTE;

/** A wallet bundle whose deposit hasn't been found on chain for `BUNDLE_UNSEEN_MS`. */
export const isBundleUnseen = (bridge: PendingBridge, now: number): boolean =>
  bridge.status === 'pending' &&
  !!bridge.bundleId &&
  !bridge.txHash &&
  now - bridge.startedAt >= BUNDLE_UNSEEN_MS;

/**
 * Nothing on chain yet, so the user may drop it: a Safe bridge still waiting
 * to execute, or (given `now`) a wallet bundle unseen for 30 minutes.
 */
export const canDismiss = (bridge: PendingBridge, now?: number): boolean =>
  (bridge.status === 'pending' && !!bridge.safeTxHash && !bridge.txHash) ||
  (now !== undefined && isBundleUnseen(bridge, now));

/** A wallet bundle that moved no funds; once its deposit was found on chain, only the tracker settles it. */
export const failBundle = (bridge: PendingBridge, reason: string, now: number): PendingBridge =>
  isSettled(bridge) || !bridge.bundleId || bridge.txHash
    ? bridge
    : { ...bridge, status: 'failed', failureReason: reason, settledAt: now };

/** A destination action the user sent and the transaction flow confirmed. */
export function recordAction(bridge: PendingBridge, action: PendingBridgeAction): PendingBridge {
  if (!bridgeActions(bridge).includes(action.action)) return bridge;
  if (bridge.actions.some(sent => !isSent(sent) && sent.txHash === action.txHash)) return bridge;
  // A Safe confirms with the on-chain hash, not the Safe tx hash it was sent with.
  const actions = [
    ...bridge.actions.filter(sent => !(isSent(sent) && sent.action === action.action)),
    {
      action: action.action,
      txHash: action.txHash,
      at: action.at,
      ...(action.bundleTxHashes?.length && { bundleTxHashes: action.bundleTxHashes })
    }
  ];
  const done = action.action;
  if (isSettled(bridge) || isFollowUpAction(done)) return { ...bridge, actions };
  // The tx mining doesn't mean its L2 execution succeeded: wait for the adapter to read it.
  // The redeem stays offered; the new deadline is read from the chain, and the stale one offers no second keepalive.
  if (done === 'keepalive') {
    const routeData = { ...bridge.routeData };
    delete routeData.timeout;
    return { ...bridge, actions, routeData, readyAt: action.at };
  }
  // The L2 execution runs inside the recovery tx, so the next read settles it.
  if (isRecoveryAction(done))
    return { ...bridge, actions, status: 'pending', nextAction: undefined, etaAt: action.at + MINUTE };
  const remaining = destinationActions(bridge.routeKind, bridge.from);
  const next = remaining[remaining.indexOf(done) + 1];
  return next
    ? { ...bridge, actions, status: 'pending', nextAction: next }
    : { ...bridge, actions, status: 'claimed', nextAction: undefined, settledAt: action.at };
}

const hasSentFollowUp = (bridge: PendingBridge) =>
  bridge.actions.some(action => isSent(action) && isFollowUpAction(action.action));

/** The tracker reads it: until it settles, then while a follow-up it sent is unconfirmed. */
export const isTracked = (bridge: PendingBridge): boolean => !isSettled(bridge) || hasSentFollowUp(bridge);

/** Tracked bridges always show; settled ones stay for a day. */
export const isPendingBridgeVisible = (bridge: PendingBridge, now: number): boolean =>
  isTracked(bridge) || now - (bridge.settledAt ?? 0) <= SETTLED_VISIBLE_MS;

/** How often the tracker checks a bridge; undefined once settled with nothing sent. */
export function pollIntervalMs(bridge: PendingBridge, now: number): number | undefined {
  if (isSettled(bridge)) return hasSentFollowUp(bridge) ? FAST_POLL_MS : undefined;
  // A queued Safe transaction: signers usually act soon, but can take days. A bundle's hash comes from recovery.
  if (!bridge.txHash) return now - bridge.startedAt <= FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
  // Anyone can send the next action, so a ready bridge can still settle without us; one left for hours backs off.
  if (bridge.status === 'ready') {
    return now - (bridge.readyAt ?? bridge.startedAt) <= FAST_POLL_WINDOW_MS ? READY_POLL_MS : SLOW_POLL_MS;
  }
  // Past the ETA: check each minute for an hour, then back off.
  if (now > bridge.etaAt) return now - bridge.etaAt <= FAST_POLL_WINDOW_MS ? OVERDUE_POLL_MS : SLOW_POLL_MS;
  return bridge.etaAt - now <= FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
}
