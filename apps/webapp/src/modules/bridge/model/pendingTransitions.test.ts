import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import {
  applyProgress,
  createPendingBridge,
  isPendingBridgeVisible,
  pollIntervalMs,
  recordAction
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
