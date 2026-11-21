/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex, Log } from 'viem';
import { BASE_BURN_AMOUNT, BASE_BURN_LOGS, BASE_BURN_TX } from '../adapters/cctp/cctp.fixtures';
import { canDismiss, createPendingBridge } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { recoverCctpBundles } from './recoverCctpBundles';
import { KNOWN_SKEW_MS } from './recoverDeposits';

// A CCTP wallet bundle no one read for longer than the scan window still gets
// its burn found, or its Dismiss: its L2 is read back to its send, once.

const START = 1_800_000_000_000;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const DEVICE_AHEAD = 5 * MINUTE;
const ACCOUNT = BASE_BURN_TX.from;
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
const AMOUNT = BASE_BURN_AMOUNT * 10n ** 12n + 5n;
/** The head at `START` of Base, a block every 200 ms: not a multiple of the window. */
const HEAD = 153_400_123n;
const BLOCK_MS = 200;
/** Blocks one scan covers: about 23 days of these blocks. */
const WINDOW = 10_000_000n;
/** Sent 40 days ago: 17 days before the window starts. */
const SENT = START - 40 * DAY;
/** The first block the scan at `START` covers, and the multiple of the window under it. */
const FIRST = HEAD - WINDOW + 1n;
const ALIGNED = (FIRST / WINDOW) * WINDOW;
const OTHER_HASH = `0x${'d7'.repeat(32)}` as Hex;

const blockAt = (deviceMs: number) => HEAD + BigInt(Math.floor((deviceMs - START) / BLOCK_MS));
const minedAt = (block: bigint) => START + Number(block - HEAD) * BLOCK_MS;
const chainSeconds = (deviceMs: number) => BigInt(Math.floor((deviceMs - DEVICE_AHEAD) / 1000));
/** A block's time is in whole seconds: five blocks share each. */
const wholeSecond = (deviceMs: number) => Math.floor(deviceMs / 1000) * 1000;

const cctpRoute = () => {
  const result = resolveBridgeRoute({
    from: 'base',
    to: 'ethereum',
    amount: 1n,
    facts: { cctp: { isOpen: true } }
  });
  if (result.status !== 'ok') throw new Error(result.reason);
  return result.route;
};

const bundle = (patch: { id?: string; at?: number; amount?: bigint } = {}) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: patch.amount ?? AMOUNT,
    from: 'base',
    to: 'ethereum',
    route: cctpRoute(),
    bundleId: patch.id ?? 'bundle-1',
    callsId: '0xcalls',
    now: patch.at ?? SENT
  });

type Range = { fromBlock: bigint; toBlock: bigint };

/** Base as the scan reads it, with every block it ever mined. */
const baseChain = () => {
  const chain = {
    burns: [] as { hash: Hex; block: bigint }[],
    /** The ranges of logs the provider fails to serve. */
    fails: (_range: Range): boolean => false,
    /** The blocks whose time the provider fails to serve. */
    hides: (_block: bigint): boolean => false,
    secondsOf: (block: bigint) => chainSeconds(minedAt(block)),
    now: START
  };
  const logsOf = (burn: { hash: Hex; block: bigint }) =>
    BASE_BURN_LOGS.map(
      log => ({ ...log, transactionHash: burn.hash, blockNumber: burn.block, removed: false }) as Log
    );
  const client = {
    getBlock: vi.fn(async (args?: { blockNumber?: bigint }) => {
      const number = args?.blockNumber ?? blockAt(chain.now);
      if (number > blockAt(chain.now)) throw new Error('no such block');
      if (args?.blockNumber !== undefined && chain.hides(number)) throw new Error('rate limited');
      return { number, timestamp: chain.secondsOf(number) };
    }),
    getLogs: vi.fn(async (range: Range) => {
      if (chain.fails(range)) throw new Error('rate limited');
      return chain.burns
        .filter(burn => burn.block >= range.fromBlock && burn.block <= range.toBlock)
        .flatMap(logsOf);
    }),
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      const burn = chain.burns.find(entry => entry.hash === hash);
      if (!burn) throw new Error('no such transaction');
      return { status: 'success', transactionHash: burn.hash, blockNumber: burn.block, logs: logsOf(burn) };
    })
  };
  return { chain, client };
};

describe('a CCTP wallet bundle sent before the blocks one scan covers', () => {
  let base = baseChain();
  let store = createPendingBridgeStore({ now: () => base.chain.now });
  const stored = (id = 'bundle-1') => store.getSnapshot(SCOPE).find(entry => entry.id === id);
  const scanAt = (now: number) => {
    base.chain.now = now;
    return recoverCctpBundles({
      store,
      scope: SCOPE,
      account: ACCOUNT,
      network: 'base',
      client: base.client as never,
      now: () => now
    });
  };
  /** Ranges of logs asked for since the last count. */
  let counted = 0;
  const reads = () => {
    const ranges = base.client.getLogs.mock.calls.slice(counted).map(([range]) => range);
    counted = base.client.getLogs.mock.calls.length;
    return ranges;
  };
  const minesAt = (at: number, hash: Hex = BASE_BURN_TX.hash) =>
    base.chain.burns.push({ hash, block: blockAt(at) });
  const expectKept = (now: number, id = 'bundle-1') => {
    expect(stored(id)).toMatchObject({ status: 'pending' });
    expect(stored(id)!.txHash).toBeUndefined();
    expect(canDismiss(stored(id)!, now)).toBe(false);
    base.chain.now = now;
    store.dismiss(SCOPE, id);
    expect(stored(id)).toBeDefined();
  };
  const expectFollowed = (hash: Hex, startedAt: number, id = 'bundle-1') => {
    expect(stored(id)).toMatchObject({ status: 'pending', txHash: hash, startedAt });
    expect(canDismiss(stored(id)!, startedAt + DAY)).toBe(false);
  };
  const belowWindow = (range: Range) => range.toBlock <= blockAt(base.chain.now) - WINDOW;

  beforeEach(() => {
    localStorage.clear();
    counted = 0;
    base = baseChain();
    store = createPendingBridgeStore({ now: () => base.chain.now });
    store.upsert(SCOPE, bundle());
  });

  it('can be dismissed once its L2 was read back to its send with no burn', async () => {
    expect(await scanAt(START)).toBe(true);
    expect(stored()).toMatchObject({ status: 'pending' });
    expect(canDismiss(stored()!, START)).toBe(true);
    store.dismiss(SCOPE, 'bundle-1');
    expect(store.getSnapshot(SCOPE)).toEqual([]);
  });

  it('is followed when its burn mined before those blocks', async () => {
    minesAt(SENT + MINUTE);
    expect(await scanAt(START)).toBe(true);
    expectFollowed(BASE_BURN_TX.hash, SENT + MINUTE);
  });

  it('does not take an identical burn from before it was sent', async () => {
    minesAt(SENT - DAY);
    expect(await scanAt(START)).toBe(true);
    expect(stored()!.txHash).toBeUndefined();
    expect(canDismiss(stored()!, START)).toBe(true);
  });

  it('cannot be dismissed while the blocks back to its send cannot be read', async () => {
    minesAt(SENT + MINUTE);
    base.chain.fails = belowWindow;
    expect(await scanAt(START)).toBe(false);
    expectKept(START);

    base.chain.fails = () => false;
    expect(await scanAt(START + 2 * MINUTE)).toBe(true);
    expectFollowed(BASE_BURN_TX.hash, SENT + MINUTE);
  });

  it('is read back to its send once: the next scans read one range', async () => {
    await scanAt(START);
    expect(canDismiss(stored()!, START)).toBe(true);
    reads();

    for (const now of [START + 30 * MINUTE, START + 60 * MINUTE, START + 5 * DAY]) {
      base.client.getBlock.mockClear();
      expect(await scanAt(now)).toBe(true);
      expect(canDismiss(stored()!, now)).toBe(true);
      expect(reads()).toHaveLength(1);
      expect(base.client.getBlock.mock.calls.length).toBeLessThanOrEqual(2);
    }
  });

  it('is still read back to its send once after a reload', async () => {
    await scanAt(START);
    reads();
    store = createPendingBridgeStore({ now: () => base.chain.now });
    expect(await scanAt(START + 30 * MINUTE)).toBe(true);
    expect(canDismiss(stored()!, START + 30 * MINUTE)).toBe(true);
    expect(reads()).toHaveLength(1);
  });

  it('finds a burn mined while no one read its L2 for longer than those blocks', async () => {
    await scanAt(START);
    expect(canDismiss(stored()!, START)).toBe(true);
    reads();
    minesAt(START + DAY);

    const back = START + 30 * DAY;
    expect(await scanAt(back)).toBe(true);
    expectFollowed(BASE_BURN_TX.hash, START + DAY);
    // From where the last read stopped, not from its send again.
    for (const range of reads()) expect(range.toBlock).toBeGreaterThanOrEqual(blockAt(START) - WINDOW);
  });

  it('cannot be dismissed after such a gap while the blocks of the gap cannot be read', async () => {
    await scanAt(START);
    const back = START + 30 * DAY;
    base.chain.fails = belowWindow;
    expect(await scanAt(back)).toBe(false);
    expectKept(back);
  });

  it('does not believe a mark of a read past the head of its L2', async () => {
    store.upsert(SCOPE, { ...bundle(), bundleReadTo: (HEAD + 10n * WINDOW).toString() } as never);
    expect(stored()).toMatchObject({ bundleReadTo: (HEAD + 10n * WINDOW).toString() });
    minesAt(SENT + MINUTE);
    expect(await scanAt(START)).toBe(true);
    expectFollowed(BASE_BURN_TX.hash, SENT + MINUTE);
  });

  describe('while the time of the first block read cannot be told', () => {
    beforeEach(() => {
      base.chain.hides = block => block === FIRST;
      minesAt(SENT + MINUTE);
      minesAt(START - DAY, OTHER_HASH);
    });

    it('is not given a later identical burn in place of its own', async () => {
      expect(await scanAt(START)).toBe(false);
      expectKept(START);

      base.chain.hides = () => false;
      expect(await scanAt(START)).toBe(true);
      expectFollowed(BASE_BURN_TX.hash, SENT + MINUTE);
    });

    it('leaves the burn of a later identical bundle to that bundle', async () => {
      store.upsert(SCOPE, bundle({ id: 'bundle-2', at: START - DAY - MINUTE }));
      expect(await scanAt(START)).toBe(false);
      expectKept(START);
      expectKept(START, 'bundle-2');

      base.chain.hides = () => false;
      expect(await scanAt(START)).toBe(true);
      expectFollowed(BASE_BURN_TX.hash, SENT + MINUTE);
      expectFollowed(OTHER_HASH, START - DAY, 'bundle-2');
    });
  });

  it('is not given a later identical burn while the time of an older block cannot be told', async () => {
    minesAt(SENT + MINUTE);
    minesAt(START - DAY, OTHER_HASH);
    base.chain.hides = block => block === ALIGNED;
    expect(await scanAt(START)).toBe(false);
    expectKept(START);

    base.chain.hides = () => false;
    expect(await scanAt(START + 2 * MINUTE)).toBe(true);
    expectFollowed(BASE_BURN_TX.hash, SENT + MINUTE);
  });

  it.each([
    ['the first of the next read', WINDOW],
    ['one before the next read starts', WINDOW + 1n]
  ])('finds a burn mined in the block after a read, when that block is %s', async (_where, later) => {
    await scanAt(START);
    expect(canDismiss(stored()!, START)).toBe(true);
    minesAt(START + BLOCK_MS);
    const now = START + Number(later) * BLOCK_MS;
    expect(await scanAt(now)).toBe(true);
    // The device's offset is read against the head's whole second.
    expectFollowed(BASE_BURN_TX.hash, START + (now % 1000));
  });

  it('reads one range when the last read ended where the next one starts', async () => {
    await scanAt(START);
    reads();
    expect(await scanAt(START + Number(WINDOW) * BLOCK_MS)).toBe(true);
    expect(reads()).toHaveLength(1);
  });

  it('reads again the blocks next to the window, which are more on every scan', async () => {
    // Mined in the blocks the first scan covers, under those of the second.
    const burnAt = minedAt(FIRST + 10n);
    minesAt(burnAt);
    base.chain.fails = range => range.toBlock < ALIGNED;
    expect(await scanAt(START)).toBe(false);
    expectKept(START);

    base.chain.fails = () => false;
    expect(await scanAt(START + 60 * MINUTE)).toBe(true);
    expectFollowed(BASE_BURN_TX.hash, wholeSecond(burnAt));
  });

  it('reads the block before the first one read when both have the same time', async () => {
    localStorage.clear();
    store = createPendingBridgeStore({ now: () => base.chain.now });
    store.upsert(SCOPE, bundle({ at: wholeSecond(minedAt(FIRST)) + KNOWN_SKEW_MS }));
    const seconds = base.chain.secondsOf;
    base.chain.secondsOf = block => seconds(block === FIRST - 1n ? FIRST : block);
    base.chain.burns.push({ hash: BASE_BURN_TX.hash, block: FIRST - 1n });
    expect(await scanAt(START)).toBe(true);
    expectFollowed(BASE_BURN_TX.hash, wholeSecond(minedAt(FIRST)));
  });

  it.each(['', 'abc', '-5', '1e9', '0x10'])(
    'does not believe a mark that is not a block number: "%s"',
    async mark => {
      store.upsert(SCOPE, { ...bundle(), bundleReadTo: mark } as never);
      minesAt(SENT + MINUTE);
      expect(await scanAt(START)).toBe(true);
      expectFollowed(BASE_BURN_TX.hash, SENT + MINUTE);
    }
  );

  it('reads the old blocks once for two bundles', async () => {
    await scanAt(START);
    const one = reads().length;

    localStorage.clear();
    base = baseChain();
    counted = 0;
    store = createPendingBridgeStore({ now: () => base.chain.now });
    store.upsert(SCOPE, bundle());
    store.upsert(SCOPE, bundle({ id: 'bundle-2', at: SENT + DAY, amount: AMOUNT + 10n ** 12n }));
    expect(await scanAt(START)).toBe(true);
    expect(reads()).toHaveLength(one);
    expect(canDismiss(stored('bundle-1')!, START)).toBe(true);
    expect(canDismiss(stored('bundle-2')!, START)).toBe(true);
  });

  describe('sent 200 days ago', () => {
    const LONG_AGO = START - 200 * DAY;
    beforeEach(() => {
      localStorage.clear();
      store = createPendingBridgeStore({ now: () => base.chain.now });
      store.upsert(SCOPE, bundle({ at: LONG_AGO }));
    });

    it('costs a read per stretch of blocks back to its send, and no more', async () => {
      minesAt(LONG_AGO + MINUTE);
      expect(await scanAt(START)).toBe(true);
      expectFollowed(BASE_BURN_TX.hash, LONG_AGO + MINUTE);
      // 200 days are under nine windows of 23.
      expect(reads().length).toBeLessThanOrEqual(11);
    });

    it('reads again only the blocks it could not read', async () => {
      const oldest = blockAt(LONG_AGO);
      base.chain.fails = range => range.fromBlock <= oldest;
      expect(await scanAt(START)).toBe(false);
      expectKept(START);
      reads();

      base.chain.fails = () => false;
      expect(await scanAt(START + 2 * MINUTE)).toBe(true);
      expect(canDismiss(stored()!, START + 2 * MINUTE)).toBe(true);
      // The window, the stretch that failed, and the one that ends where the window starts.
      expect(reads().length).toBeLessThanOrEqual(3);
    });
  });

  it('stops at the first block of its L2, whenever the card says it was sent', async () => {
    localStorage.clear();
    store = createPendingBridgeStore({ now: () => base.chain.now });
    store.upsert(SCOPE, bundle({ at: 1 }));
    expect(await scanAt(START)).toBe(true);
    expect(canDismiss(stored()!, START)).toBe(true);
    expect(reads().length).toBeLessThanOrEqual(Number(HEAD / WINDOW) + 2);
  });
});
