import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyProgress,
  canConvert,
  createPendingBridge,
  isTracked,
  pollIntervalMs,
  recordActionSent,
  type BridgeProgress
} from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import type { PendingBridge, PendingBridgeAction } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { trackBridge } from './trackBridge';

// The chain can settle a CCTP bridge (its nonce used) before the user's own claim is read as mined.

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });

const ready = (): PendingBridge => {
  const result = resolveBridgeRoute({ from: 'base', to: 'ethereum', amount: 1n, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  const bridge = createPendingBridge({
    account: ACCOUNT,
    amount: 1n,
    from: 'base',
    to: 'ethereum',
    route: result.route,
    txHash: '0xsource',
    now: NOW
  });
  return applyProgress(bridge, { kind: 'ready', nextAction: 'claim' }, NOW);
};

type Reader = (bridge: PendingBridge, sent: PendingBridgeAction) => Promise<BridgeProgress | null>;

describe('trackBridge: a claim the chain settled before it was read as mined', () => {
  let store = createPendingBridgeStore({ now: () => NOW });
  const run = ({
    adapterProgress = null,
    readSafeAction = vi.fn(async () => null)
  }: {
    adapterProgress?: BridgeProgress | null;
    readSafeAction?: Reader;
  }) => {
    const adapter = { checkProgress: vi.fn(async () => adapterProgress) };
    const tracked = trackBridge({
      store,
      scope: SCOPE,
      id: '0xsource',
      now: () => NOW,
      getAdapter: () => adapter,
      context: { getClient: () => undefined },
      readSafeTx: vi.fn(async () => null),
      readSafeAction
    });
    return { adapter, tracked };
  };
  const stored = () => store.getSnapshot(SCOPE)[0];
  const send = (action: Omit<PendingBridgeAction, 'at'>) => {
    store.upsert(SCOPE, recordActionSent(ready(), { ...action, at: NOW }));
  };

  beforeEach(() => {
    localStorage.clear();
    store = createPendingBridgeStore({ now: () => NOW });
  });

  it("keeps reading a Safe's claim and offers Convert once the service reports it executed", async () => {
    send({ action: 'claim', txHash: '0xsafetx', safe: true });
    // The Safe service hasn't indexed the execution yet; the nonce is already used.
    await run({ adapterProgress: { kind: 'arrived' } }).tracked;
    expect(stored().status).toBe('claimed');
    expect(isTracked(stored())).toBe(true);

    const readSafeAction = vi.fn<Reader>(async () => ({
      kind: 'action-confirmed',
      action: 'claim',
      txHash: '0xreceive'
    }));
    await run({ readSafeAction }).tracked;
    expect(readSafeAction).toHaveBeenCalled();
    expect(stored().actions).toEqual([{ action: 'claim', txHash: '0xreceive', at: NOW }]);
    expect(isTracked(stored())).toBe(false);
    expect(canConvert(stored(), ACCOUNT)).toBe(true);
  });

  it('keeps reading a claim sent from this browser that mined between the two reads', async () => {
    send({ action: 'claim', txHash: '0xclaim' });
    await run({ adapterProgress: { kind: 'arrived' } }).tracked;
    expect(stored().status).toBe('claimed');

    const { adapter, tracked } = run({
      adapterProgress: { kind: 'action-confirmed', action: 'claim', txHash: '0xclaim' }
    });
    await tracked;
    expect(adapter.checkProgress).toHaveBeenCalled();
    expect(stored().actions).toEqual([{ action: 'claim', txHash: '0xclaim', at: NOW }]);
    expect(canConvert(stored(), ACCOUNT)).toBe(true);
  });

  it('offers the claim nowhere once the chain settled it and the Safe proposal was dropped', async () => {
    send({ action: 'claim', txHash: '0xsafetx', safe: true });
    await run({ adapterProgress: { kind: 'arrived' } }).tracked;
    await run({ readSafeAction: async () => ({ kind: 'action-dropped', txHash: '0xsafetx' }) }).tracked;
    expect(stored().actions).toEqual([]);
    expect(isTracked(stored())).toBe(false);
  });

  // Safe signers can take days: a settled card waiting on one backs off after an hour, as a queued Safe bridge does.
  it("polls a settled bridge's Safe claim fast for an hour, then backs off", async () => {
    send({ action: 'claim', txHash: '0xsafetx', safe: true });
    await run({ adapterProgress: { kind: 'arrived' } }).tracked;
    expect(pollIntervalMs(stored(), NOW + MINUTE)).toBe(15_000);
    expect(pollIntervalMs(stored(), NOW + 2 * HOUR)).toBe(5 * MINUTE);
  });
});
