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

  it('finds a swap by its hash in any case, only in its scope', () => {
    const store = createCctpSwapStore();
    store.record(SCOPE, swap());
    expect(store.get(SCOPE, '0x' + 'Ab'.repeat(32))?.usdcAmount).toBe(1_000_000n);
    expect(store.get('other', '0x' + 'ab'.repeat(32))).toBeUndefined();
    expect(store.get(SCOPE, '0x' + 'cd'.repeat(32))).toBeUndefined();
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

describe('createCctpSwapStore when writes fail but reads work', () => {
  const hash = (n: string) => '0x' + n.repeat(64);
  // A storage of its own: spies on Storage.prototype don't reliably come off between tests here.
  const items = new Map<string, string>();
  let writable = true;
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (!writable) throw new DOMException('quota', 'QuotaExceededError');
      items.set(key, value);
    }
  };
  beforeEach(() => {
    items.clear();
    writable = false;
    vi.stubGlobal('localStorage', storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps every session-only swap it records', () => {
    const store = createCctpSwapStore();
    store.record(SCOPE, swap({ swapTxHash: hash('a') }));
    store.record(SCOPE, swap({ swapTxHash: hash('b') }));
    expect(store.getSnapshot(SCOPE).map(entry => entry.swapTxHash)).toEqual([hash('b'), hash('a')]);
  });

  it('drops a session-only swap once cleared', () => {
    const store = createCctpSwapStore();
    store.record(SCOPE, swap({ swapTxHash: hash('a') }));
    store.clear(SCOPE, hash('a'));
    expect(store.getSnapshot(SCOPE)).toEqual([]);
  });

  it("drops a stored swap once cleared, though the write didn't reach storage", () => {
    writable = true;
    createCctpSwapStore().record(SCOPE, swap({ swapTxHash: hash('a') }));
    writable = false;
    const store = createCctpSwapStore();
    store.clear(SCOPE, hash('a'));
    store.record(SCOPE, swap({ swapTxHash: hash('b') }));
    expect(store.getSnapshot(SCOPE).map(entry => entry.swapTxHash)).toEqual([hash('b')]);
  });

  it("keeps its session-only swaps when another tab writes, with the other tab's", () => {
    const store = createCctpSwapStore();
    store.subscribe(() => {});
    store.record(SCOPE, swap({ swapTxHash: hash('a') }));
    writable = true;
    createCctpSwapStore().record(SCOPE, swap({ swapTxHash: hash('c') }));
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    expect(
      store
        .getSnapshot(SCOPE)
        .map(entry => entry.swapTxHash)
        .sort()
    ).toEqual([hash('a'), hash('c')]);
  });
});

describe('createCctpSwapStore burn links', () => {
  beforeEach(() => localStorage.clear());

  const SWAP_HASH = '0x' + 'ab'.repeat(32);
  const burns = (store: ReturnType<typeof createCctpSwapStore>) =>
    store.getSnapshot(SCOPE).map(entry => entry.burn);

  it('links a swap to the burn last sent for it, in storage, lowercase', () => {
    const store = createCctpSwapStore();
    store.record(SCOPE, swap());
    store.record(SCOPE, swap({ swapTxHash: '0x' + 'cd'.repeat(32) }));
    store.markBurn(SCOPE, '0x' + 'AB'.repeat(32), '0xBURN1');
    store.markBurn(SCOPE, SWAP_HASH, '0xburn2');
    expect(
      createCctpSwapStore()
        .getSnapshot(SCOPE)
        .map(entry => [entry.swapTxHash, entry.burn])
    ).toEqual([
      ['0x' + 'cd'.repeat(32), undefined],
      [SWAP_HASH, '0xburn2']
    ]);
  });

  it('keeps when the convert was linked across a reload, and forgets it once unlinked', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);
    const store = createCctpSwapStore();
    store.record(SCOPE, swap());
    store.markConvert(SCOPE, SWAP_HASH, '0xconvert');
    expect(createCctpSwapStore().getSnapshot(SCOPE)[0]).toMatchObject({
      convert: '0xconvert',
      convertAt: 5_000
    });
    store.markConvert(SCOPE, SWAP_HASH, undefined);
    expect(createCctpSwapStore().getSnapshot(SCOPE)[0]).not.toHaveProperty('convertAt');
    vi.restoreAllMocks();
  });

  it('drops a stored convert time of the wrong type', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { ...swap(), usdcAmount: '1', convert: '0xc', convertAt: 'soon' },
        { ...swap({ swapTxHash: '0x01' }), usdcAmount: '1', convert: '0xc', convertAt: 9 }
      ])
    );
    expect(
      createCctpSwapStore()
        .getSnapshot(SCOPE)
        .map(entry => [entry.swapTxHash, entry.convertAt])
    ).toEqual([['0x01', 9]]);
  });

  it('links nothing to a swap it does not hold, and notifies only on a change', () => {
    const store = createCctpSwapStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.markBurn(SCOPE, SWAP_HASH, '0xburn');
    expect(store.getSnapshot(SCOPE)).toEqual([]);
    store.record(SCOPE, swap());
    store.markBurn(SCOPE, SWAP_HASH, '0xburn');
    store.markBurn(SCOPE, SWAP_HASH, '0xBURN');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('returns the burn a new one replaced, and nothing for a first or repeated link', () => {
    const store = createCctpSwapStore();
    expect(store.markBurn(SCOPE, SWAP_HASH, '0xburn1')).toBeUndefined();
    store.record(SCOPE, swap());
    expect(store.markBurn(SCOPE, SWAP_HASH, '0xburn1')).toBeUndefined();
    expect(store.markBurn(SCOPE, SWAP_HASH, '0xBURN1')).toBeUndefined();
    expect(store.markBurn(SCOPE, SWAP_HASH, 'calls-2')).toBe('0xburn1');
  });

  it('drops only the swaps whose burn is among the mined ids', () => {
    const store = createCctpSwapStore();
    store.record(SCOPE, swap());
    store.record(SCOPE, swap({ swapTxHash: '0x' + 'cd'.repeat(32) }));
    store.record(SCOPE, swap({ swapTxHash: '0x' + 'ef'.repeat(32) }));
    store.markBurn(SCOPE, SWAP_HASH, 'calls-1');
    store.markBurn(SCOPE, '0x' + 'cd'.repeat(32), '0xother');
    store.clearBurned(SCOPE, ['bundle-1', '0xBURN', undefined, 'CALLS-1']);
    expect(burns(store)).toEqual([undefined, '0xother']);
  });

  it('drops a stored burn link of the wrong type', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { ...swap(), usdcAmount: '1', burn: 7 },
        { ...swap({ swapTxHash: '0x01' }), usdcAmount: '1' }
      ])
    );
    expect(
      createCctpSwapStore()
        .getSnapshot(SCOPE)
        .map(entry => entry.swapTxHash)
    ).toEqual(['0x01']);
  });
});

describe('createCctpSwapStore convert links', () => {
  beforeEach(() => localStorage.clear());

  const SWAP_HASH = '0x' + 'ab'.repeat(32);

  it('links a swap to the convert sent for its USDC, in storage, lowercase, and unlinks it', () => {
    const store = createCctpSwapStore();
    store.record(SCOPE, swap());
    store.markConvert(SCOPE, '0x' + 'AB'.repeat(32), '0xCONVERT');
    expect(createCctpSwapStore().getSnapshot(SCOPE)[0].convert).toBe('0xconvert');
    store.markConvert(SCOPE, SWAP_HASH, undefined);
    expect(createCctpSwapStore().getSnapshot(SCOPE)[0]).not.toHaveProperty('convert');
  });

  it('links nothing to a swap it does not hold, and notifies only on a change', () => {
    const store = createCctpSwapStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.markConvert(SCOPE, SWAP_HASH, '0xconvert');
    expect(store.getSnapshot(SCOPE)).toEqual([]);
    store.record(SCOPE, swap());
    store.markConvert(SCOPE, SWAP_HASH, '0xconvert');
    store.markConvert(SCOPE, SWAP_HASH, '0xCONVERT');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('drops a stored convert link of the wrong type', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { ...swap(), usdcAmount: '1', convert: 7 },
        { ...swap({ swapTxHash: '0x01' }), usdcAmount: '1', convert: '0xc' }
      ])
    );
    expect(
      createCctpSwapStore()
        .getSnapshot(SCOPE)
        .map(entry => [entry.swapTxHash, entry.convert])
    ).toEqual([['0x01', '0xc']]);
  });
});

// A convert sent as a wallet bundle is linked by its calls id: only the wallet can tell how it ended.
describe('createCctpSwapStore bundled convert links', () => {
  beforeEach(() => localStorage.clear());

  const SWAP_HASH = '0x' + 'ab'.repeat(32);

  it('keeps that a convert was sent as a bundle across a reload, and forgets it once unlinked or relinked by hash', () => {
    const store = createCctpSwapStore();
    store.record(SCOPE, swap());
    store.markConvert(SCOPE, SWAP_HASH, 'CALLS-ID', { bundle: true });
    expect(createCctpSwapStore().getSnapshot(SCOPE)[0]).toMatchObject({
      convert: 'calls-id',
      convertBundled: true
    });
    store.markConvert(SCOPE, SWAP_HASH, '0xconvert');
    expect(createCctpSwapStore().getSnapshot(SCOPE)[0]).toMatchObject({ convert: '0xconvert' });
    expect(createCctpSwapStore().getSnapshot(SCOPE)[0].convertBundled).toBeUndefined();
    store.markConvert(SCOPE, SWAP_HASH, 'calls-id', { bundle: true });
    store.markConvert(SCOPE, SWAP_HASH, undefined);
    expect(createCctpSwapStore().getSnapshot(SCOPE)[0].convertBundled).toBeUndefined();
  });

  it('drops a stored bundle flag of the wrong type', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { ...swap(), usdcAmount: '1', convert: '0xc', convertBundled: 'yes' },
        { ...swap({ swapTxHash: '0x01' }), usdcAmount: '1', convert: '0xc', convertBundled: true }
      ])
    );
    expect(
      createCctpSwapStore()
        .getSnapshot(SCOPE)
        .map(entry => [entry.swapTxHash, entry.convertBundled])
    ).toEqual([['0x01', true]]);
  });
});

describe('createCctpSwapStore never loses what it cannot read', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  // A newer bundle (a later field or network) wrote this entry under the same key.
  const future = { ...swap({ swapTxHash: '0xfuture' }), usdcAmount: '1', network: 'polygon' };
  const seed = () =>
    localStorage.setItem(
      KEY,
      JSON.stringify([future, { ...swap({ swapTxHash: '0x01' }), usdcAmount: '1000000' }])
    );
  const storedHashes = () =>
    (JSON.parse(localStorage.getItem(KEY)!) as { swapTxHash: string }[]).map(entry => entry.swapTxHash);

  it('a record keeps an entry it cannot parse', () => {
    seed();
    createCctpSwapStore().record(SCOPE, swap({ swapTxHash: '0x02' }));
    expect(storedHashes()).toEqual(expect.arrayContaining(['0x02', '0x01', '0xfuture']));
  });

  it('a link keeps an entry it cannot parse', () => {
    seed();
    createCctpSwapStore().markBurn(SCOPE, '0x01', '0xburn');
    expect(storedHashes()).toEqual(expect.arrayContaining(['0x01', '0xfuture']));
  });

  it('keeps a copy of an unreadable value before replacing it', () => {
    localStorage.setItem(KEY, '[{"swapTxHash":"0xfuture", not json');
    createCctpSwapStore().record(SCOPE, swap({ swapTxHash: '0x02' }));
    expect(localStorage.getItem(`${KEY}:unreadable`)).toBe('[{"swapTxHash":"0xfuture", not json');
    expect(storedHashes()).toEqual(['0x02']);
  });

  it('does not replace an unreadable value it could not copy', () => {
    localStorage.setItem(KEY, '{not json');
    const setItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key.endsWith(':unreadable')) throw new Error('QuotaExceededError');
      setItem(key, value);
    });
    const store = createCctpSwapStore();
    store.record(SCOPE, swap({ swapTxHash: '0x02' }));
    expect(localStorage.getItem(KEY)).toBe('{not json');
    expect(store.getSnapshot(SCOPE).map(entry => entry.swapTxHash)).toEqual(['0x02']);
  });
});
