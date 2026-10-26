import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import {
  applyProgress,
  createPendingBridge,
  isPendingBridgeVisible,
  canDismiss,
  canLaunchAction,
  canLaunchKeepalive,
  closeCard,
  dropSentAction,
  isTracked,
  pollIntervalMs,
  recordAction,
  recordActionSent,
  REDEEM_URGENT_MINUTES,
  showsActionButton,
  ticketMinutesLeft
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

  it('hides a settled bridge the user closed', () => {
    expect(isPendingBridgeVisible(closeCard(settled(deposit()), NOW), NOW + MINUTE)).toBe(false);
  });
});

describe('closeCard', () => {
  const settled = (bridge: PendingBridge) => applyProgress(bridge, { kind: 'arrived' }, NOW);

  it('closes a settled bridge once, keeping it for Activity', () => {
    const open = settled(deposit());
    const closed = closeCard(open, NOW + MINUTE);
    expect(closed).toEqual({ ...open, closedAt: NOW + MINUTE });
    expect(closeCard(closed, NOW + HOUR)).toBe(closed);
  });

  it('never closes a bridge the tracker still reads', () => {
    const onItsWay = deposit();
    expect(closeCard(onItsWay, NOW)).toBe(onItsWay);
    const converting = {
      ...settled(deposit()),
      actions: [{ action: 'convert' as const, txHash: '0xc0', at: NOW, status: 'sent' as const }]
    };
    expect(closeCard(converting, NOW)).toBe(converting);
    expect(isPendingBridgeVisible(converting, NOW + 25 * HOUR)).toBe(true);
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

  it('keeps polling ready bridges, since anyone can send the next action, and backs off after an hour', () => {
    const ready = applyProgress(
      create(routeFor('base', 'ethereum')),
      { kind: 'ready', nextAction: 'claim' },
      NOW
    );
    expect(pollIntervalMs(ready, NOW)).toBe(MINUTE);
    expect(pollIntervalMs(ready, NOW + 59 * MINUTE)).toBe(MINUTE);
    expect(pollIntervalMs(ready, NOW + 2 * HOUR)).toBe(5 * MINUTE);
    expect(pollIntervalMs(ready, NOW + 30 * 24 * HOUR)).toBe(5 * MINUTE);
  });

  it('counts the hour from when the bridge became ready, not from its ETA', () => {
    // An OP withdrawal is ready to prove about an hour in, days before its ETA.
    const withdrawal = create(routeFor('base', 'ethereum', false));
    const ready = applyProgress(withdrawal, { kind: 'ready', nextAction: 'prove' }, NOW + HOUR);
    expect(pollIntervalMs(ready, NOW + HOUR + MINUTE)).toBe(MINUTE);
    expect(pollIntervalMs(ready, NOW + 3 * HOUR)).toBe(5 * MINUTE);
    const stillReady = applyProgress(ready, { kind: 'ready', nextAction: 'prove' }, NOW + 3 * HOUR);
    expect(stillReady.readyAt).toBe(NOW + HOUR);
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

describe('a lagging poll never re-offers an action that is already confirmed', () => {
  const proven = () =>
    recordAction(
      applyProgress(
        create(routeFor('optimism', 'ethereum', false)),
        { kind: 'ready', nextAction: 'prove' },
        NOW
      ),
      { action: 'prove', txHash: '0xprove', at: NOW }
    );

  it('a lagging "ready to prove" poll does not make Prove launchable again', () => {
    const lagging = applyProgress(proven(), { kind: 'ready', nextAction: 'prove' }, NOW + MINUTE);
    expect(lagging).toMatchObject({ status: 'pending', nextAction: 'finalize' });
    expect(canLaunchAction(lagging)).toBe(false);
  });

  it('a lagging "waiting for prove" poll does not move nextAction back to prove', () => {
    const lagging = applyProgress(proven(), { kind: 'waiting', nextAction: 'prove' }, NOW + MINUTE);
    expect(lagging.nextAction).toBe('finalize');
  });

  it('the next action still becomes ready', () => {
    const ready = applyProgress(proven(), { kind: 'ready', nextAction: 'finalize' }, NOW + MINUTE);
    expect(canLaunchAction(ready)).toBe(true);
  });
});

describe('a confirmed action the chain no longer honours can be sent again (OP re-prove)', () => {
  const DAY = 24 * HOUR;
  const invalidated = () =>
    applyProgress(
      recordAction(
        applyProgress(
          create(routeFor('optimism', 'ethereum', false)),
          { kind: 'ready', nextAction: 'prove' },
          NOW
        ),
        { action: 'prove', txHash: '0xprove', at: NOW }
      ),
      { kind: 'action-invalidated', action: 'prove' },
      NOW + 8 * DAY
    );

  it('an invalidated prove goes back to waiting for prove, and Finalize is no longer offered', () => {
    const bridge = invalidated();
    expect(bridge).toMatchObject({ status: 'pending', nextAction: 'prove' });
    expect(canLaunchAction(bridge)).toBe(false);
  });

  it('the re-prove becomes launchable when the chain says it is ready', () => {
    const ready = applyProgress(invalidated(), { kind: 'ready', nextAction: 'prove' }, NOW + 8 * DAY);
    expect(ready).toMatchObject({ status: 'ready', nextAction: 'prove' });
    expect(canLaunchAction(ready)).toBe(true);
  });

  it('the first prove stays in the history, and the re-prove then moves on to finalize', () => {
    const reproven = recordAction(
      applyProgress(invalidated(), { kind: 'ready', nextAction: 'prove' }, NOW + 8 * DAY),
      { action: 'prove', txHash: '0xreprove', at: NOW + 8 * DAY }
    );
    expect(reproven.actions.map(({ txHash, status }) => ({ txHash, status }))).toEqual([
      { txHash: '0xprove', status: 'invalidated' },
      { txHash: '0xreprove', status: undefined }
    ]);
    expect(reproven).toMatchObject({ status: 'pending', nextAction: 'finalize' });
  });

  it('invalidating an action that was never confirmed changes nothing', () => {
    const bridge = applyProgress(
      create(routeFor('optimism', 'ethereum', false)),
      { kind: 'ready', nextAction: 'prove' },
      NOW
    );
    expect(applyProgress(bridge, { kind: 'action-invalidated', action: 'prove' }, NOW)).toBe(bridge);
  });
});

describe('a queued Safe bridge can be dismissed, nothing else can', () => {
  const route = routeFor('base', 'ethereum');

  it('a Safe bridge still waiting to execute can be dismissed', () => {
    expect(canDismiss(create(route, { safeTxHash: '0xsafe' }))).toBe(true);
  });

  it('a bridge with an on-chain transaction cannot', () => {
    const executed = applyProgress(
      create(route, { safeTxHash: '0xsafe' }),
      { kind: 'source-executed', txHash: '0xsource' },
      NOW
    );
    expect(canDismiss(executed)).toBe(false);
    expect(canDismiss(create(route))).toBe(false);
  });

  it('a settled Safe bridge cannot', () => {
    const failed = applyProgress(
      create(route, { safeTxHash: '0xsafe' }),
      { kind: 'failed', reason: 'x' },
      NOW
    );
    expect(canDismiss(failed)).toBe(false);
  });
});

describe('a deposit whose L2 execution failed (redeem on Arbitrum, replay on OP Stack)', () => {
  const depositTo = (to: BridgeNetworkId) =>
    createPendingBridge({
      account: ACCOUNT,
      amount: 1n,
      from: 'ethereum',
      to,
      route: routeFor('ethereum', to),
      txHash: '0xdeposit',
      now: NOW
    });
  const readyRedeem = () =>
    applyProgress(depositTo('arbitrum'), { kind: 'ready', nextAction: 'redeem' }, NOW + MINUTE);

  it('a deposit that arrives on its own never shows an action button', () => {
    const waiting = depositTo('base');
    expect(showsActionButton(waiting)).toBe(false);
    expect(showsActionButton(applyProgress(waiting, { kind: 'arrived' }, NOW))).toBe(false);
  });

  it('a failed Arbitrum deposit offers Redeem, and a failed OP Stack deposit offers Replay', () => {
    const redeem = readyRedeem();
    expect(redeem).toMatchObject({ status: 'ready', nextAction: 'redeem' });
    expect(showsActionButton(redeem)).toBe(true);
    expect(canLaunchAction(redeem)).toBe(true);
    const replay = applyProgress(depositTo('optimism'), { kind: 'ready', nextAction: 'replay' }, NOW);
    expect(showsActionButton(replay)).toBe(true);
  });

  it('a mined redeem does not settle the bridge: it waits for the chain to say the USDS arrived', () => {
    const sent = recordActionSent(readyRedeem(), { action: 'redeem', txHash: '0xredeem', at: NOW });
    expect(canLaunchAction(sent)).toBe(false);
    const mined = recordAction(sent, { action: 'redeem', txHash: '0xredeem', at: NOW + MINUTE });
    expect(mined).toMatchObject({ status: 'pending', nextAction: undefined });
    expect(mined.settledAt).toBeUndefined();
    expect(mined.actions).toEqual([{ action: 'redeem', txHash: '0xredeem', at: NOW + MINUTE }]);
    expect(showsActionButton(mined)).toBe(false);
    // Delivered inside the redeem: the card reads "~1 min" and the tracker polls fast, not "taking longer".
    expect(mined.etaAt).toBe(NOW + 2 * MINUTE);
    expect(pollIntervalMs(mined, NOW + MINUTE)).toBe(15_000);
    expect(applyProgress(mined, { kind: 'arrived' }, NOW + 2 * MINUTE)).toMatchObject({
      status: 'arrived',
      settledAt: NOW + 2 * MINUTE
    });
  });

  it('a redeem whose retry failed again is offered again', () => {
    const mined = recordAction(readyRedeem(), { action: 'redeem', txHash: '0xredeem', at: NOW });
    const again = applyProgress(mined, { kind: 'ready', nextAction: 'redeem' }, NOW + MINUTE);
    expect(again).toMatchObject({ status: 'ready', nextAction: 'redeem' });
    expect(canLaunchAction(again)).toBe(true);
  });

  it('a redeem seen from chain (anyone can redeem) is recorded the same way', () => {
    const seen = applyProgress(
      readyRedeem(),
      { kind: 'action-confirmed', action: 'redeem', txHash: '0xother', at: NOW },
      NOW
    );
    expect(seen).toMatchObject({ status: 'pending', nextAction: undefined });
    expect(seen.actions).toHaveLength(1);
  });

  it('a replay on an Arbitrum deposit, or a redeem on an OP Stack one, is ignored', () => {
    const redeem = readyRedeem();
    expect(recordAction(redeem, { action: 'replay', txHash: '0xr', at: NOW })).toBe(redeem);
    const op = depositTo('base');
    expect(recordActionSent(op, { action: 'redeem', txHash: '0xr', at: NOW })).toBe(op);
  });

  it('an expired ticket settles as expired, with no action, and ignores later progress', () => {
    const expired = applyProgress(readyRedeem(), { kind: 'expired' }, NOW + HOUR);
    expect(expired).toMatchObject({ status: 'expired', nextAction: undefined, settledAt: NOW + HOUR });
    expect(showsActionButton(expired)).toBe(false);
    expect(canLaunchAction(expired)).toBe(false);
    expect(pollIntervalMs(expired, NOW + HOUR)).toBeUndefined();
    expect(applyProgress(expired, { kind: 'ready', nextAction: 'redeem' }, NOW + 2 * HOUR)).toBe(expired);
  });

  it('a claim route still shows its action button before it is ready', () => {
    const withdrawal = create(routeFor('base', 'ethereum'));
    expect(withdrawal.nextAction).toBe('claim');
    expect(showsActionButton(withdrawal)).toBe(true);
  });
});

describe('an Arbitrum ticket close to its deadline can be kept alive', () => {
  const timeoutIn = (minutes: number) => String(Math.floor((NOW + minutes * MINUTE) / 1000));
  const ready = (timeout = timeoutIn(REDEEM_URGENT_MINUTES - 1), to: BridgeNetworkId = 'arbitrum') =>
    applyProgress(
      createPendingBridge({
        account: ACCOUNT,
        amount: 1n,
        from: 'ethereum',
        to,
        route: routeFor('ethereum', to),
        txHash: '0xdeposit',
        now: NOW
      }),
      {
        kind: 'ready',
        nextAction: 'redeem',
        routeData: { ticketId: '0xticket', ...(timeout && { timeout }) }
      },
      NOW
    );

  it('only under 48 hours left, and not once the time is up', () => {
    expect(ticketMinutesLeft(ready(), NOW)).toBe(REDEEM_URGENT_MINUTES - 1);
    expect(canLaunchKeepalive(ready(), NOW)).toBe(true);
    expect(canLaunchKeepalive(ready(timeoutIn(REDEEM_URGENT_MINUTES)), NOW)).toBe(false);
    expect(canLaunchKeepalive(ready(timeoutIn(1)), NOW)).toBe(true);
    expect(canLaunchKeepalive(ready(timeoutIn(0)), NOW)).toBe(false);
    expect(canLaunchKeepalive(ready(timeoutIn(-5)), NOW)).toBe(false);
  });

  it('never with an unknown deadline, or off a ready Arbitrum redeem', () => {
    expect(canLaunchKeepalive(ready(''), NOW)).toBe(false);
    expect(canLaunchKeepalive(ready('soon'), NOW)).toBe(false);
    expect(canLaunchKeepalive({ ...ready(), status: 'pending' }, NOW)).toBe(false);
    expect(canLaunchKeepalive({ ...ready(), nextAction: 'replay' }, NOW)).toBe(false);
    expect(canLaunchKeepalive({ ...ready(), to: 'base' }, NOW)).toBe(false);
    expect(canLaunchKeepalive({ ...ready(), routeKind: 'layerzero' }, NOW)).toBe(false);
  });

  it('not while a redeem or keepalive is in flight', () => {
    for (const action of ['redeem', 'keepalive'] as const)
      expect(canLaunchKeepalive(recordActionSent(ready(), { action, txHash: '0xsent', at: NOW }), NOW)).toBe(
        false
      );
  });

  it('a mined keepalive keeps the redeem offered and drops the stale deadline, so it is not offered twice', () => {
    const sent = recordActionSent(ready(), { action: 'keepalive', txHash: '0xkeep', at: NOW });
    // The redeem itself can still go out.
    expect(canLaunchAction(sent)).toBe(true);
    const mined = recordAction(sent, { action: 'keepalive', txHash: '0xkeep', at: NOW + MINUTE });
    expect(mined).toMatchObject({ status: 'ready', nextAction: 'redeem', readyAt: NOW + MINUTE });
    expect(mined.routeData).toEqual({ ticketId: '0xticket' });
    expect(mined.settledAt).toBeUndefined();
    expect(mined.actions).toEqual([{ action: 'keepalive', txHash: '0xkeep', at: NOW + MINUTE }]);
    expect(canLaunchKeepalive(mined, NOW + MINUTE)).toBe(false);
    expect(canLaunchAction(mined)).toBe(true);
    const extended = applyProgress(
      mined,
      {
        kind: 'ready',
        nextAction: 'redeem',
        routeData: { ticketId: '0xticket', timeout: timeoutIn(8 * 24 * 60) }
      },
      NOW + 2 * MINUTE
    );
    expect(ticketMinutesLeft(extended, NOW + MINUTE)).toBeGreaterThan(REDEEM_URGENT_MINUTES);
  });

  it('is never the next action, and is ignored off Arbitrum', () => {
    const op = ready('', 'base');
    expect(recordActionSent(op, { action: 'keepalive', txHash: '0xkeep', at: NOW })).toBe(op);
  });
});

// A bundle's calls id resolves only through the wallet, which can answer after the chain settled the bridge.
describe('a destination action sent as a wallet bundle', () => {
  const ready = () =>
    applyProgress(create(routeFor('base', 'ethereum')), { kind: 'ready', nextAction: 'claim' }, NOW);
  const bundled = recordActionSent(ready(), { action: 'claim', txHash: '0xcalls', at: NOW, bundle: true });
  const settled = applyProgress(bundled, { kind: 'arrived' }, NOW + MINUTE);

  it('blocks a second launch and keeps the settled bridge tracked until the wallet answers', () => {
    expect(canLaunchAction(bundled)).toBe(false);
    expect(settled.status).toBe('claimed');
    expect(isTracked(settled)).toBe(true);
    const answered = applyProgress(
      settled,
      { kind: 'action-confirmed', action: 'claim', txHash: '0xreceive', bundleTxHashes: ['0xsell'] },
      NOW + 2 * MINUTE
    );
    expect(answered.actions).toEqual([
      { action: 'claim', txHash: '0xreceive', at: NOW + 2 * MINUTE, bundleTxHashes: ['0xsell'] }
    ]);
    expect(isTracked(answered)).toBe(false);
  });

  it('polls the wallet fast for an hour, then backs off', () => {
    expect(pollIntervalMs(settled, NOW + MINUTE)).toBe(15_000);
    expect(pollIntervalMs(settled, NOW + 2 * HOUR)).toBe(5 * MINUTE);
  });

  it('offers the action again once the wallet reports the bundle failed', () => {
    const dropped = applyProgress(bundled, { kind: 'action-dropped', txHash: '0xcalls' }, NOW + MINUTE);
    expect(dropped.actions).toEqual([]);
    expect(canLaunchAction(dropped)).toBe(true);
  });
});
