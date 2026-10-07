import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import {
  applyProgress,
  createPendingBridge,
  isPendingBridgeVisible,
  canLaunchAction,
  dropSentAction,
  pollIntervalMs,
  recordAction,
  recordActionSent
} from './pendingTransitions';
import { resolveBridgeRoute } from './resolveRoute';
import type { BridgeNetworkId } from './networks';
import type { BridgeRoute, PendingBridge } from './types';

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

const routeFor = (from: BridgeNetworkId, to: BridgeNetworkId, cctpOpen = true): BridgeRoute => {
  const result = resolveBridgeRoute({ from, to, amount: 1n, facts: { cctp: { isOpen: cctpOpen } } });
  if (result.status !== 'ok') throw new Error(result.reason);
  return result.route;
};

const create = (route: BridgeRoute, ids: { txHash?: string; safeTxHash?: string } = { txHash: '0xsource' }) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: parseUnits('100', 18),
    from: route.steps[0].network,
    to: 'ethereum',
    route,
    ...ids,
    now: NOW
  });

const deposit = () =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 1n,
    from: 'ethereum',
    to: 'base',
    route: routeFor('ethereum', 'base'),
    txHash: '0xdeposit',
    now: NOW
  });

describe('createPendingBridge', () => {
  it('starts pending, keyed by the source tx, with the ETA from the route', () => {
    const bridge = deposit();
    expect(bridge).toMatchObject({
      id: '0xdeposit',
      account: ACCOUNT.toLowerCase(),
      status: 'pending',
      routeKind: 'native',
      requiresClaim: false,
      startedAt: NOW,
      etaAt: NOW + 3 * MINUTE,
      txHash: '0xdeposit',
      actions: []
    });
    expect(bridge.nextAction).toBeUndefined();
  });

  it('a CCTP bridge has claim as the upcoming action', () => {
    expect(create(routeFor('base', 'ethereum')).nextAction).toBe('claim');
  });

  it('a queued Safe transaction is keyed by its Safe tx hash, with no tx hash yet', () => {
    const bridge = create(routeFor('base', 'ethereum'), { safeTxHash: '0xsafe' });
    expect(bridge.id).toBe('0xsafe');
    expect(bridge.safeTxHash).toBe('0xsafe');
    expect(bridge.txHash).toBeUndefined();
  });

  it('throws without any source identifier', () => {
    expect(() => create(routeFor('base', 'ethereum'), {})).toThrow();
  });
});

describe('applyProgress', () => {
  it('a Safe transaction executing sets the tx hash, keeps the id and restarts the clock', () => {
    const queued = create(routeFor('base', 'ethereum'), { safeTxHash: '0xsafe' });
    const executedAt = NOW + 48 * HOUR;
    const bridge = applyProgress(queued, { kind: 'source-executed', txHash: '0xexec' }, executedAt);
    expect(bridge).toMatchObject({
      id: '0xsafe',
      txHash: '0xexec',
      status: 'pending',
      startedAt: executedAt,
      etaAt: executedAt + (queued.etaAt - queued.startedAt)
    });
  });

  it('a Safe execution reported twice keeps the first clock', () => {
    const queued = create(routeFor('base', 'ethereum'), { safeTxHash: '0xsafe' });
    const once = applyProgress(queued, { kind: 'source-executed', txHash: '0xexec' }, NOW + HOUR);
    const twice = applyProgress(once, { kind: 'source-executed', txHash: '0xexec' }, NOW + 5 * HOUR);
    expect(twice).toEqual(once);
  });

  it('a Safe execution starts the clock at the execution time the service reports', () => {
    const queued = create(routeFor('base', 'ethereum'), { safeTxHash: '0xsafe' });
    const executedAt = NOW + 2 * HOUR;
    const bridge = applyProgress(
      queued,
      { kind: 'source-executed', txHash: '0xexec', executedAt },
      NOW + 6 * HOUR
    );
    expect(bridge).toMatchObject({
      startedAt: executedAt,
      etaAt: executedAt + (queued.etaAt - queued.startedAt)
    });
  });

  it('a ready attestation makes a CCTP bridge ready to claim and keeps the route data', () => {
    const bridge = applyProgress(
      create(routeFor('base', 'ethereum')),
      { kind: 'ready', nextAction: 'claim', routeData: { messageHash: '0xm' } },
      NOW
    );
    expect(bridge).toMatchObject({ status: 'ready', nextAction: 'claim', routeData: { messageHash: '0xm' } });
  });

  it('waiting updates the ETA and merges route data', () => {
    const start = applyProgress(
      create(routeFor('base', 'ethereum', false)),
      { kind: 'waiting', routeData: { withdrawalHash: '0xw' } },
      NOW
    );
    const bridge = applyProgress(
      start,
      { kind: 'waiting', etaAt: NOW + HOUR, routeData: { output: '7' } },
      NOW
    );
    expect(bridge).toMatchObject({
      status: 'pending',
      etaAt: NOW + HOUR,
      routeData: { withdrawalHash: '0xw', output: '7' }
    });
  });

  it('an automatic arrival settles a no-claim bridge', () => {
    expect(applyProgress(deposit(), { kind: 'arrived' }, NOW + MINUTE)).toMatchObject({
      status: 'arrived',
      settledAt: NOW + MINUTE
    });
  });

  it('a claim sent by someone else (anyone can claim) settles as claimed', () => {
    const ready = applyProgress(
      create(routeFor('base', 'ethereum')),
      { kind: 'ready', nextAction: 'claim' },
      NOW
    );
    expect(applyProgress(ready, { kind: 'arrived' }, NOW + MINUTE)).toMatchObject({
      status: 'claimed',
      nextAction: undefined,
      settledAt: NOW + MINUTE
    });
  });

  it('a failed source settles as failed with the reason', () => {
    expect(applyProgress(deposit(), { kind: 'failed', reason: 'reverted' }, NOW)).toMatchObject({
      status: 'failed',
      failureReason: 'reverted',
      settledAt: NOW
    });
  });

  it('settled bridges ignore further progress', () => {
    const arrived = applyProgress(deposit(), { kind: 'arrived' }, NOW);
    expect(applyProgress(arrived, { kind: 'failed', reason: 'late' }, NOW + HOUR)).toBe(arrived);
  });
});

describe('recordAction', () => {
  it('a confirmed claim settles a CCTP bridge as claimed', () => {
    const ready = applyProgress(
      create(routeFor('base', 'ethereum')),
      { kind: 'ready', nextAction: 'claim' },
      NOW
    );
    const bridge = recordAction(ready, { action: 'claim', txHash: '0xclaim', at: NOW + MINUTE });
    expect(bridge).toMatchObject({
      status: 'claimed',
      nextAction: undefined,
      settledAt: NOW + MINUTE,
      actions: [{ action: 'claim', txHash: '0xclaim', at: NOW + MINUTE }]
    });
  });

  it('an action the route does not have is ignored', () => {
    const withdrawal = applyProgress(
      create(routeFor('optimism', 'ethereum', false)),
      { kind: 'ready', nextAction: 'finalize' },
      NOW
    );
    expect(recordAction(withdrawal, { action: 'claim', txHash: '0xclaim', at: NOW })).toBe(withdrawal);
  });

  it('an OP Stack prove moves on to waiting for finalize', () => {
    const ready = applyProgress(
      create(routeFor('optimism', 'ethereum', false)),
      { kind: 'ready', nextAction: 'prove' },
      NOW
    );
    const bridge = recordAction(ready, { action: 'prove', txHash: '0xprove', at: NOW });
    expect(bridge).toMatchObject({ status: 'pending', nextAction: 'finalize' });
    expect(bridge.settledAt).toBeUndefined();
    expect(recordAction(bridge, { action: 'finalize', txHash: '0xfin', at: NOW + 1 })).toMatchObject({
      status: 'claimed',
      actions: [{ action: 'prove' }, { action: 'finalize' }]
    });
  });

  it('an Arbitrum withdrawal finalizes in one action', () => {
    const bridge = create(routeFor('arbitrum', 'ethereum', false));
    expect(bridge.nextAction).toBe('finalize');
    expect(recordAction(bridge, { action: 'finalize', txHash: '0xexec', at: NOW }).status).toBe('claimed');
  });

  it('recording the same tx twice is a no-op', () => {
    const ready = applyProgress(
      create(routeFor('base', 'ethereum')),
      { kind: 'ready', nextAction: 'claim' },
      NOW
    );
    const once = recordAction(ready, { action: 'claim', txHash: '0xclaim', at: NOW });
    expect(recordAction(once, { action: 'claim', txHash: '0xclaim', at: NOW })).toBe(once);
  });
});

describe('isPendingBridgeVisible', () => {
  const settled = (bridge: PendingBridge) => applyProgress(bridge, { kind: 'arrived' }, NOW);

  it('shows active bridges regardless of age', () => {
    expect(isPendingBridgeVisible(deposit(), NOW + 30 * 24 * HOUR)).toBe(true);
  });

  it('shows settled bridges for 24 hours', () => {
    expect(isPendingBridgeVisible(settled(deposit()), NOW + 23 * HOUR)).toBe(true);
    expect(isPendingBridgeVisible(settled(deposit()), NOW + 25 * HOUR)).toBe(false);
  });
});

describe('pollIntervalMs', () => {
  it('stops polling settled bridges', () => {
    expect(pollIntervalMs(applyProgress(deposit(), { kind: 'arrived' }, NOW), NOW)).toBeUndefined();
  });

  it('polls fast near the ETA and slowly on multi-day withdrawals', () => {
    expect(pollIntervalMs(deposit(), NOW)).toBe(15_000);
    const withdrawal = create(routeFor('base', 'ethereum', false));
    expect(pollIntervalMs(withdrawal, NOW)).toBe(5 * MINUTE);
    expect(pollIntervalMs(withdrawal, withdrawal.etaAt - MINUTE)).toBe(15_000);
  });

  it('past the ETA polls every minute for an hour, then every five minutes', () => {
    const late = deposit();
    expect(pollIntervalMs(late, late.etaAt + MINUTE)).toBe(MINUTE);
    expect(pollIntervalMs(late, late.etaAt + 59 * MINUTE)).toBe(MINUTE);
    expect(pollIntervalMs(late, late.etaAt + 2 * HOUR)).toBe(5 * MINUTE);
  });

  it('polls a queued Safe transaction fast for an hour, then slowly while the signers take their time', () => {
    const queued = create(routeFor('base', 'ethereum', false), { safeTxHash: '0xsafe' });
    expect(pollIntervalMs(queued, NOW)).toBe(15_000);
    expect(pollIntervalMs(queued, NOW + 2 * HOUR)).toBe(5 * MINUTE);
  });

  it('keeps polling ready bridges slowly, since anyone can send the next action', () => {
    const ready = applyProgress(
      create(routeFor('base', 'ethereum')),
      { kind: 'ready', nextAction: 'claim' },
      NOW
    );
    expect(pollIntervalMs(ready, NOW)).toBe(MINUTE);
  });
});

describe('destination actions sent before they are confirmed', () => {
  const readyClaim = () =>
    applyProgress(create(routeFor('base', 'ethereum')), { kind: 'ready', nextAction: 'claim' }, NOW);

  it('a sent action does not advance the bridge, and blocks a second launch', () => {
    const ready = readyClaim();
    expect(canLaunchAction(ready)).toBe(true);
    const sent = recordActionSent(ready, { action: 'claim', txHash: '0xclaim', at: NOW });
    expect(sent).toMatchObject({ status: 'ready', nextAction: 'claim' });
    expect(sent.settledAt).toBeUndefined();
    expect(canLaunchAction(sent)).toBe(false);
  });

  it('confirming a sent action advances once, without a duplicate entry', () => {
    const sent = recordActionSent(readyClaim(), { action: 'claim', txHash: '0xclaim', at: NOW });
    const confirmed = recordAction(sent, { action: 'claim', txHash: '0xclaim', at: NOW + MINUTE });
    expect(confirmed).toMatchObject({ status: 'claimed', settledAt: NOW + MINUTE });
    expect(confirmed.actions).toHaveLength(1);
    expect(confirmed.actions[0]).not.toMatchObject({ status: 'sent' });
  });

  it('a Safe confirms with the on-chain hash, which replaces the sent Safe tx hash', () => {
    const sent = recordActionSent(readyClaim(), { action: 'claim', txHash: '0xsafetx', at: NOW });
    const confirmed = recordAction(sent, { action: 'claim', txHash: '0xexec', at: NOW + 1 });
    expect(confirmed.actions).toEqual([{ action: 'claim', txHash: '0xexec', at: NOW + 1 }]);
  });

  it('dropping a reverted sent action lets the user try again', () => {
    const sent = recordActionSent(readyClaim(), { action: 'claim', txHash: '0xclaim', at: NOW });
    const dropped = dropSentAction(sent, '0xclaim');
    expect(dropped.actions).toEqual([]);
    expect(canLaunchAction(dropped)).toBe(true);
  });

  it('dropping never removes a confirmed action', () => {
    const ready = applyProgress(
      create(routeFor('optimism', 'ethereum', false)),
      { kind: 'ready', nextAction: 'prove' },
      NOW
    );
    const proven = recordAction(ready, { action: 'prove', txHash: '0xprove', at: NOW });
    expect(dropSentAction(proven, '0xprove')).toBe(proven);
  });

  it('a sent action the route does not have, or a hash already there, is ignored', () => {
    const ready = readyClaim();
    expect(recordActionSent(ready, { action: 'finalize', txHash: '0xf', at: NOW })).toBe(ready);
    const sent = recordActionSent(ready, { action: 'claim', txHash: '0xclaim', at: NOW });
    expect(recordActionSent(sent, { action: 'claim', txHash: '0xclaim', at: NOW + 1 })).toBe(sent);
  });

  it('a stored action without a status reads as confirmed', () => {
    const ready = applyProgress(
      create(routeFor('optimism', 'ethereum', false)),
      { kind: 'ready', nextAction: 'prove' },
      NOW
    );
    const legacy = applyProgress(
      { ...ready, actions: [{ action: 'prove', txHash: '0xprove', at: NOW }], nextAction: 'finalize' },
      { kind: 'ready', nextAction: 'finalize' },
      NOW
    );
    expect(canLaunchAction(legacy)).toBe(true);
  });

  it('only a ready bridge can launch its action', () => {
    expect(canLaunchAction(create(routeFor('base', 'ethereum')))).toBe(false);
  });
});

describe('a sent action confirmed or released from chain', () => {
  const sentClaim = (txHash = '0xclaim') =>
    recordActionSent(
      applyProgress(create(routeFor('base', 'ethereum')), { kind: 'ready', nextAction: 'claim' }, NOW),
      { action: 'claim', txHash, at: NOW }
    );

  it('a sent action the chain dropped can be launched again, while the tracker still says ready', () => {
    const released = applyProgress(sentClaim(), { kind: 'action-dropped', txHash: '0xclaim' }, NOW + HOUR);
    const polled = applyProgress(released, { kind: 'ready', nextAction: 'claim' }, NOW + HOUR);
    expect(canLaunchAction(polled)).toBe(true);
  });

  it('a Safe action dropped by its Safe tx hash can be launched again', () => {
    const released = applyProgress(
      sentClaim('0xsafetx'),
      { kind: 'action-dropped', txHash: '0xsafetx' },
      NOW
    );
    expect(canLaunchAction(released)).toBe(true);
  });

  it('a sent action the chain confirmed advances the bridge once', () => {
    const progress = {
      kind: 'action-confirmed',
      action: 'claim',
      txHash: '0xclaim',
      at: NOW + MINUTE
    } as const;
    const confirmed = applyProgress(sentClaim(), progress, NOW + HOUR);
    expect(confirmed).toMatchObject({ status: 'claimed', settledAt: NOW + MINUTE });
    expect(confirmed.actions).toEqual([{ action: 'claim', txHash: '0xclaim', at: NOW + MINUTE }]);
    expect(applyProgress(confirmed, progress, NOW + 2 * HOUR)).toBe(confirmed);
  });

  it('a confirmation without a time is dated when it is seen', () => {
    const confirmed = applyProgress(
      sentClaim(),
      { kind: 'action-confirmed', action: 'claim', txHash: '0xclaim' },
      NOW + HOUR
    );
    expect(confirmed.settledAt).toBe(NOW + HOUR);
  });

  it('dropping twice, or dropping a confirmed action, changes nothing', () => {
    const released = applyProgress(sentClaim(), { kind: 'action-dropped', txHash: '0xclaim' }, NOW);
    expect(applyProgress(released, { kind: 'action-dropped', txHash: '0xclaim' }, NOW)).toBe(released);
    const confirmed = applyProgress(
      sentClaim(),
      { kind: 'action-confirmed', action: 'claim', txHash: '0xclaim', at: NOW },
      NOW
    );
    expect(applyProgress(confirmed, { kind: 'action-dropped', txHash: '0xclaim' }, NOW)).toBe(confirmed);
  });

  it('a confirmation seen after the bridge arrived is kept, and the bridge stays settled', () => {
    const arrived = applyProgress(sentClaim(), { kind: 'arrived' }, NOW + MINUTE);
    const confirmed = applyProgress(
      arrived,
      { kind: 'action-confirmed', action: 'claim', txHash: '0xclaim', at: NOW },
      NOW + HOUR
    );
    expect(confirmed).toMatchObject({ status: 'claimed', settledAt: NOW + MINUTE });
    expect(confirmed.actions).toEqual([{ action: 'claim', txHash: '0xclaim', at: NOW }]);
  });
});
