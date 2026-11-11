import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridgeStore, pendingScopeKey } from './pendingStore';
import type { PendingBridge } from '../model/types';

const NOW = 1_800_000_000_000;
const SENDER = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x00000000000000000000000000000000000b0b01';
const scopeOf = (account: string, familyChainId = 1) => pendingScopeKey({ account, familyChainId });

const bridge = (overrides: Partial<PendingBridge> = {}): PendingBridge => ({
  id: '0xsource',
  account: SENDER,
  amount: 1n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  startedAt: NOW,
  etaAt: NOW + 20 * 60_000,
  txHash: '0xsource',
  actions: [],
  ...overrides
});

describe('pendingBridgeStore.scopesIn', () => {
  const make = () => createPendingBridgeStore({ now: () => NOW });

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists every account's scope stored in the chain family, and none of another family", () => {
    const store = make();
    store.upsert(scopeOf(SENDER), bridge());
    store.upsert(scopeOf(OTHER), bridge({ id: '0xother', txHash: '0xother' }));
    store.upsert(scopeOf(SENDER, 314310), bridge());
    expect(store.scopesIn(1).sort()).toEqual([scopeOf(SENDER), scopeOf(OTHER)].sort());
    expect(store.scopesIn(314310)).toEqual([scopeOf(SENDER, 314310)]);
  });

  it('skips the copy of an unreadable list and other keys', () => {
    const store = make();
    localStorage.setItem(`bridgePending:v1:${scopeOf(SENDER)}`, '{');
    store.upsert(scopeOf(SENDER), bridge());
    localStorage.setItem('cctpSwaps:v1:1:0xabc', '[]');
    expect(localStorage.getItem(`bridgePending:v1:${scopeOf(SENDER)}:unreadable`)).toBe('{');
    expect(store.scopesIn(1)).toEqual([scopeOf(SENDER)]);
  });

  it("keeps a scope whose write reached only this session's copy", () => {
    const store = make();
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    store.upsert(scopeOf(OTHER), bridge());
    expect(setItem).toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(store.scopesIn(1)).toEqual([scopeOf(OTHER)]);
    setItem.mockRestore();
  });

  it('lists nothing when storage throws', () => {
    const store = make();
    store.upsert(scopeOf(SENDER), bridge());
    const key = vi.fn(() => {
      throw new Error('denied');
    });
    vi.stubGlobal('localStorage', { length: 1, key });
    expect(store.scopesIn(1)).toEqual([]);
    expect(key).toHaveBeenCalled();
  });
});
