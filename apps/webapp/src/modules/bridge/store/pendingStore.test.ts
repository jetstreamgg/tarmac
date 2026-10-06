import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridgeStore, pendingScopeKey } from './pendingStore';
import type { PendingBridge } from '../model/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });

const bridge = (overrides: Partial<PendingBridge> = {}): PendingBridge => ({
  id: '0xsource',
  account: ACCOUNT,
  amount: 123456789012345678901234n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: NOW,
  etaAt: NOW + 20 * 60_000,
  txHash: '0xsource',
  actions: [],
  ...overrides
});

describe('pendingScopeKey', () => {
  it('scopes by lowercase account and chain family, not by network', () => {
    expect(pendingScopeKey({ account: ACCOUNT.toUpperCase().replace('0X', '0x'), familyChainId: 1 })).toBe(
      SCOPE
    );
    expect(pendingScopeKey({ account: ACCOUNT, familyChainId: 314310 })).not.toBe(SCOPE);
  });
});

describe('createPendingBridgeStore', () => {
  let now = NOW;
  const make = () => createPendingBridgeStore({ now: () => now });

  beforeEach(() => {
    now = NOW;
    localStorage.clear();
  });
  afterEach(() => localStorage.clear());

  it('round-trips bigint amounts through storage', () => {
    make().upsert(SCOPE, bridge());
    expect(make().getSnapshot(SCOPE)).toEqual([bridge()]);
  });

  it('keeps scopes apart', () => {
    const store = make();
    store.upsert(SCOPE, bridge());
    expect(store.getSnapshot(pendingScopeKey({ account: ACCOUNT, familyChainId: 314310 }))).toEqual([]);
  });

  it('returns a stable snapshot until something changes', () => {
    const store = make();
    store.upsert(SCOPE, bridge());
    const first = store.getSnapshot(SCOPE);
    expect(store.getSnapshot(SCOPE)).toBe(first);
    store.update(SCOPE, '0xsource', current => ({ ...current, status: 'ready' }));
    expect(store.getSnapshot(SCOPE)).not.toBe(first);
  });

  it('lists newest first and replaces an entry with the same id', () => {
    const store = make();
    store.upsert(SCOPE, bridge({ id: '0xa', txHash: '0xa', startedAt: NOW }));
    store.upsert(SCOPE, bridge({ id: '0xb', txHash: '0xb', startedAt: NOW + 1 }));
    store.upsert(SCOPE, bridge({ id: '0xa', txHash: '0xa', startedAt: NOW, status: 'ready' }));
    expect(store.getSnapshot(SCOPE).map(entry => [entry.id, entry.status])).toEqual([
      ['0xb', 'pending'],
      ['0xa', 'ready']
    ]);
  });

  it('matches a Safe bridge by its Safe tx hash, so a second submit does not duplicate it', () => {
    const store = make();
    store.upsert(SCOPE, bridge({ id: '0xsafe', safeTxHash: '0xsafe', txHash: undefined }));
    store.upsert(SCOPE, bridge({ id: '0xexec', safeTxHash: '0xsafe', txHash: '0xexec' }));
    expect(store.getSnapshot(SCOPE)).toEqual([
      bridge({ id: '0xsafe', safeTxHash: '0xsafe', txHash: '0xexec' })
    ]);
  });

  it('update is a no-op for an unknown id or an unchanged entry', () => {
    const store = make();
    const listener = vi.fn();
    store.upsert(SCOPE, bridge());
    store.subscribe(listener);
    store.update(SCOPE, '0xmissing', current => ({ ...current, status: 'ready' }));
    store.update(SCOPE, '0xsource', current => current);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies subscribers on writes and on writes from another tab', () => {
    const store = make();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.upsert(SCOPE, bridge());
    expect(listener).toHaveBeenCalledTimes(1);

    make().upsert(SCOPE, bridge({ id: '0xother', txHash: '0xother', startedAt: NOW + 1 }));
    window.dispatchEvent(new StorageEvent('storage', { key: `bridgePending:v1:${SCOPE}` }));
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot(SCOPE)).toHaveLength(2);

    window.dispatchEvent(new StorageEvent('storage', { key: 'somethingElse' }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('drops settled bridges after 90 days but keeps active ones forever', () => {
    make().upsert(SCOPE, bridge({ id: '0xold', txHash: '0xold', status: 'arrived', settledAt: NOW }));
    make().upsert(SCOPE, bridge({ id: '0xstuck', txHash: '0xstuck', status: 'ready', startedAt: NOW - 1 }));
    now = NOW + 91 * DAY;
    expect(
      make()
        .getSnapshot(SCOPE)
        .map(entry => entry.id)
    ).toEqual(['0xstuck']);
  });

  it('skips malformed entries and unreadable storage', () => {
    localStorage.setItem(
      `bridgePending:v1:${SCOPE}`,
      JSON.stringify([{ id: 'broken' }, { ...bridge(), amount: bridge().amount.toString() }])
    );
    expect(make().getSnapshot(SCOPE)).toEqual([bridge()]);
    localStorage.setItem(`bridgePending:v1:${SCOPE}`, '{not json');
    expect(make().getSnapshot(SCOPE)).toEqual([]);
  });
});
