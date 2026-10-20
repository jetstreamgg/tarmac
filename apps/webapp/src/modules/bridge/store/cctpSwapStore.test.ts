/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCctpSwapStore, type UnfinishedCctpSwap } from './cctpSwapStore';

const SCOPE = 'scope';
const KEY = `bridgeCctpSwap:v1:${SCOPE}`;
const swap = (overrides: Partial<UnfinishedCctpSwap> = {}): UnfinishedCctpSwap => ({
  swapTxHash: '0x' + 'AB'.repeat(32),
  network: 'base',
  usdcAmount: 1_000_000n,
  recipient: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  at: 1,
  ...overrides
});

describe('createCctpSwapStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('keeps a swap across stores, lowercase, with its exact USDC amount', () => {
    createCctpSwapStore().record(SCOPE, swap({ usdcAmount: 123_456_789_012_345n }));
    expect(createCctpSwapStore().getSnapshot(SCOPE)).toEqual([
      swap({
        swapTxHash: '0x' + 'ab'.repeat(32),
        recipient: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
        usdcAmount: 123_456_789_012_345n
      })
    ]);
    expect(createCctpSwapStore().getSnapshot('other')).toEqual([]);
  });

  it('records a swap once, whatever the case of its hash', () => {
    const store = createCctpSwapStore();
    store.record(SCOPE, swap());
    store.record(SCOPE, swap({ swapTxHash: '0x' + 'ab'.repeat(32), usdcAmount: 2n }));
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
    expect(store.getSnapshot(SCOPE)[0].usdcAmount).toBe(1_000_000n);
  });

  it('drops only the cleared swap, and notifies', () => {
    const store = createCctpSwapStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.record(SCOPE, swap());
    store.record(SCOPE, swap({ swapTxHash: '0x' + 'cd'.repeat(32) }));
    store.clear(SCOPE, '0x' + 'AB'.repeat(32));
    expect(store.getSnapshot(SCOPE).map(entry => entry.swapTxHash)).toEqual(['0x' + 'cd'.repeat(32)]);
    expect(listener).toHaveBeenCalledTimes(3);
    store.clear(SCOPE, '0x' + 'ef'.repeat(32));
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it('drops entries it cannot trust: wrong shape, unknown network, no USDC', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { ...swap(), usdcAmount: '5' },
        { ...swap(), usdcAmount: '0' },
        { ...swap(), usdcAmount: 'x' },
        { ...swap(), usdcAmount: 5 },
        { ...swap(), network: 'ethereum', usdcAmount: '5' },
        null
      ])
    );
    expect(createCctpSwapStore().getSnapshot(SCOPE)).toHaveLength(1);
    localStorage.setItem(KEY, '{not json');
    expect(createCctpSwapStore().getSnapshot(SCOPE)).toEqual([]);
  });

  it('keeps the session copy when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const store = createCctpSwapStore();
    store.record(SCOPE, swap());
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
  });

  it('reads again when another tab writes', () => {
    const store = createCctpSwapStore();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.getSnapshot(SCOPE)).toEqual([]);
    createCctpSwapStore().record(SCOPE, swap());
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(listener).toHaveBeenCalledOnce();
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
  });
});
