import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import {
  applyProgress,
  canLaunchConvert,
  createPendingBridge,
  dropSentAction,
  isPendingBridgeVisible,
  isTracked,
  pollIntervalMs,
  recordAction,
  recordActionSent,
  showsActionButton
} from './pendingTransitions';
import { followUpActions, isRecoveryAction, resolveBridgeRoute } from './resolveRoute';
import type { BridgeNetworkId } from './networks';
import type { PendingBridge } from './types';

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ACCOUNT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

// With CCTP closed, an L2 to Ethereum bridge takes the native withdrawal.
const bridgeOf = (from: BridgeNetworkId, to: BridgeNetworkId, cctpOpen = true) => {
  const result = resolveBridgeRoute({ from, to, amount: 1n, facts: { cctp: { isOpen: cctpOpen } } });
  if (result.status !== 'ok') throw new Error(result.reason);
  return createPendingBridge({
    account: ACCOUNT,
    amount: parseUnits('100', 18),
    from,
    to,
    route: result.route,
    txHash: '0xsource',
    now: NOW
  });
};

const cctp = () => bridgeOf('base', 'ethereum');
const claimed = (): PendingBridge =>
  recordAction(applyProgress(cctp(), { kind: 'ready', nextAction: 'claim' }, NOW), {
    action: 'claim',
    txHash: '0xclaim',
    at: NOW + MINUTE
  });
const arrived = () => applyProgress(cctp(), { kind: 'arrived' }, NOW + MINUTE);
const convertSent = (bridge = claimed()) =>
  recordActionSent(bridge, { action: 'convert', txHash: '0xsell', at: NOW + 2 * MINUTE });

describe('followUpActions', () => {
  it('a CCTP transfer to Ethereum can be converted to USDS after it is claimed', () => {
    for (const from of ['base', 'optimism', 'unichain', 'arbitrum'] as const)
      expect(followUpActions('cctp', from, 'ethereum')).toEqual(['convert']);
  });

  it('no other route has one', () => {
    expect(followUpActions('native', 'base', 'ethereum')).toEqual([]);
    expect(followUpActions('native', 'ethereum', 'arbitrum')).toEqual([]);
    expect(followUpActions('layerzero', 'ethereum', 'avalanche')).toEqual([]);
  });

  it('convert is not a recovery action', () => {
    expect(isRecoveryAction('convert')).toBe(false);
  });
});

describe('canLaunchConvert', () => {
  it('a claimed or arrived CCTP transfer to Ethereum can be converted', () => {
    expect(canLaunchConvert(claimed())).toBe(true);
    expect(canLaunchConvert(arrived())).toBe(true);
  });

  it('not before its USDC landed, nor after it failed', () => {
    const bridge = cctp();
    expect(canLaunchConvert(bridge)).toBe(false);
    expect(canLaunchConvert(applyProgress(bridge, { kind: 'ready', nextAction: 'claim' }, NOW))).toBe(false);
    expect(canLaunchConvert(applyProgress(bridge, { kind: 'failed', reason: 'x' }, NOW))).toBe(false);
  });

  it('only on a CCTP transfer to Ethereum', () => {
    const withdrawal = applyProgress(bridgeOf('arbitrum', 'ethereum', false), { kind: 'arrived' }, NOW);
    expect(withdrawal.routeKind).toBe('native');
    expect(canLaunchConvert(withdrawal)).toBe(false);
  });

  it('never twice: not while one is sent, nor once one is confirmed', () => {
    const sent = convertSent();
    expect(canLaunchConvert(sent)).toBe(false);
    expect(
      canLaunchConvert(recordAction(sent, { action: 'convert', txHash: '0xsell', at: NOW + 3 * MINUTE }))
    ).toBe(false);
  });

  it('again once the sent one reverted', () => {
    expect(canLaunchConvert(dropSentAction(convertSent(), '0xsell'))).toBe(true);
  });
});

describe('recording a convert', () => {
  it('a sent convert is kept on the claimed bridge, which stays settled', () => {
    const bridge = claimed();
    const sent = convertSent(bridge);
    expect(sent).toMatchObject({ status: 'claimed', settledAt: bridge.settledAt });
    expect(sent.actions.at(-1)).toEqual({
      action: 'convert',
      txHash: '0xsell',
      at: NOW + 2 * MINUTE,
      status: 'sent'
    });
  });

  it('a confirmed convert replaces the sent one and settles nothing again', () => {
    const bridge = claimed();
    const done = recordAction(convertSent(bridge), {
      action: 'convert',
      txHash: '0xsell',
      at: NOW + 3 * MINUTE
    });
    expect(done).toMatchObject({ status: 'claimed', settledAt: bridge.settledAt, nextAction: undefined });
    expect(done.actions.filter(action => action.action === 'convert')).toEqual([
      { action: 'convert', txHash: '0xsell', at: NOW + 3 * MINUTE }
    ]);
    expect(recordAction(done, { action: 'convert', txHash: '0xsell', at: NOW + 4 * MINUTE })).toBe(done);
  });

  it('the tracker confirms or drops it on a settled bridge', () => {
    const sent = convertSent();
    const confirmed = applyProgress(
      sent,
      { kind: 'action-confirmed', action: 'convert', txHash: '0xsell' },
      NOW
    );
    expect(confirmed.actions.at(-1)).toEqual({ action: 'convert', txHash: '0xsell', at: NOW });
    expect(applyProgress(sent, { kind: 'action-dropped', txHash: '0xsell' }, NOW).actions).toEqual(
      claimed().actions
    );
  });

  it('a route without it ignores it', () => {
    const withdrawal = applyProgress(bridgeOf('arbitrum', 'ethereum', false), { kind: 'arrived' }, NOW);
    expect(recordActionSent(withdrawal, { action: 'convert', txHash: '0xsell', at: NOW })).toBe(withdrawal);
    expect(recordAction(withdrawal, { action: 'convert', txHash: '0xsell', at: NOW })).toBe(withdrawal);
  });

  it('shows no action button: the card offers it on its own', () => {
    expect(showsActionButton(claimed())).toBe(false);
  });
});

describe('tracking a sent convert', () => {
  it('a settled bridge is tracked only while a convert is sent', () => {
    expect(isTracked(cctp())).toBe(true);
    expect(isTracked(claimed())).toBe(false);
    const sent = convertSent();
    expect(isTracked(sent)).toBe(true);
    expect(isTracked(recordAction(sent, { action: 'convert', txHash: '0xsell', at: NOW }))).toBe(false);
  });

  it('is polled until it settles', () => {
    expect(pollIntervalMs(claimed(), NOW + HOUR)).toBeUndefined();
    expect(pollIntervalMs(convertSent(), NOW + HOUR)).toBe(15_000);
  });

  it('stays visible past the settled day while a convert is sent', () => {
    expect(isPendingBridgeVisible(claimed(), NOW + 25 * HOUR)).toBe(false);
    expect(isPendingBridgeVisible(convertSent(), NOW + 25 * HOUR)).toBe(true);
  });
});
