/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex, Log } from 'viem';
import { BASE_BURN_AMOUNT, BASE_BURN_LOGS, BASE_BURN_TX } from '../adapters/cctp/cctp.fixtures';
import type { BridgeAdapter } from '../adapters/types';
import { canDismiss, createPendingBridge } from '../model/pendingTransitions';
import { nativeDepositRoute, resolveBridgeRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { recoverCctpBundles } from './recoverCctpBundles';
import { recoverDeposits } from './recoverDeposits';

// A CCTP wallet bundle the wallet can't report on has no hash, so nothing reads
// its burn. Its card must find the burn on the L2 itself, and may be dismissed
// only once a whole read of the L2, long enough after the send, found no burn.

const START = 1_800_000_000_000;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
// The device clock runs ahead of the chain's.
const DEVICE_AHEAD = 5 * MINUTE;
const ACCOUNT = BASE_BURN_TX.from;
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
// The burn carries USDC: the dust under its 6 decimals is not in it.
const AMOUNT = BASE_BURN_AMOUNT * 10n ** 12n + 5n;
const HEAD = 53_000_000n;
/** The first block the scan of Base reads. */
const WINDOW_START = HEAD - 1_000_000n + 1n;
const OTHER_HASH = `0x${'d7'.repeat(32)}` as Hex;

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

const bundle = (patch: { id?: string; at?: number; amount?: bigint; recipient?: string } = {}) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: patch.amount ?? AMOUNT,
    from: 'base',
    to: 'ethereum',
    ...(patch.recipient && { recipient: patch.recipient }),
    route: cctpRoute(),
    bundleId: patch.id ?? 'bundle-1',
    callsId: '0xcalls',
    now: patch.at ?? START
  });

type Burn = { hash: Hex; block: bigint; minedAt: number; logs?: Log[] };
type Failing = 'head' | 'logs' | 'receipt' | 'block' | 'window';

/** Base as the scan reads it: `minedAt` and `now` are device times, the chain's run `DEVICE_AHEAD` behind. */
const baseChain = () => {
  const chain = {
    burns: [] as Burn[],
    failing: undefined as Failing | undefined,
    /** Device time of the head block; the device's own time when unset. */
    headAt: undefined as number | undefined,
    /** Device time of the first block the scan reads. */
    windowAt: START - 20 * DAY,
    now: START
  };
  const chainSeconds = (deviceMs: number) => BigInt(Math.floor((deviceMs - DEVICE_AHEAD) / 1000));
  const fail = (what: Failing) => {
    if (chain.failing === what) throw new Error('rate limited');
  };
  const logsOf = (burn: Burn) =>
    (burn.logs ?? BASE_BURN_LOGS).map(
      log => ({ ...log, transactionHash: burn.hash, blockNumber: burn.block, removed: false }) as Log
    );
  const client = {
    getBlock: vi.fn(async (args?: { blockNumber?: bigint }) => {
      if (args?.blockNumber === undefined) {
        fail('head');
        return { number: HEAD, timestamp: chainSeconds(chain.headAt ?? chain.now) };
      }
      if (args.blockNumber === WINDOW_START) {
        fail('window');
        return { number: WINDOW_START, timestamp: chainSeconds(chain.windowAt) };
      }
      fail('block');
      const burn = chain.burns.find(entry => entry.block === args.blockNumber);
      if (!burn) throw new Error('no such block');
      return { number: burn.block, timestamp: chainSeconds(burn.minedAt) };
    }),
    getLogs: vi.fn(async () => {
      fail('logs');
      return chain.burns.flatMap(logsOf);
    }),
    getTransactionReceipt: vi.fn(async ({ hash }: { hash: Hex }) => {
      fail('receipt');
      const burn = chain.burns.find(entry => entry.hash === hash);
      if (!burn) throw new Error('no such transaction');
      return { status: 'success', transactionHash: burn.hash, blockNumber: burn.block, logs: logsOf(burn) };
    })
  };
  return { chain, client };
};

describe('a CCTP wallet bundle the wallet cannot report on', () => {
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
  const minesAt = (minedAt: number, hash: Hex = BASE_BURN_TX.hash, block = 52_837_683n) =>
    base.chain.burns.push({ hash, block, minedAt });
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

  beforeEach(() => {
    localStorage.clear();
    base = baseChain();
    store = createPendingBridgeStore({ now: () => base.chain.now });
    store.upsert(SCOPE, bundle());
  });

  it('gets no hash from the wallet path, and gets it from its L2', async () => {
    minesAt(START + MINUTE);
    const callsStatus = vi.fn(async () => {
      throw new Error('wallet_getCallsStatus: unknown bundle');
    });
    const checkProgress = vi.fn<BridgeAdapter['checkProgress']>(async () => null);
    await recoverDeposits({
      store,
      scope: SCOPE,
      account: ACCOUNT,
      deposits: [],
      now: () => START + 2 * MINUTE,
      blockTime: async () => START,
      adapter: { checkProgress },
      context: { getClient: () => undefined },
      settled: new Set(),
      callsStatus
    });
    expect(callsStatus).toHaveBeenCalledWith('0xcalls');
    expect(stored()!.txHash).toBeUndefined();

    expect(await scanAt(START + 2 * MINUTE)).toBe(true);
    // The card starts when its burn mined, on the device's clock.
    expectFollowed(BASE_BURN_TX.hash, START + MINUTE);
  });

  it('cannot be dismissed just because 30 minutes went by', () => {
    expectKept(START + 31 * MINUTE);
    expectKept(START + 30 * DAY);
  });

  it.each<Failing>(['head', 'logs'])(
    'cannot be dismissed when its L2 could not be read (%s)',
    async failing => {
      base.chain.failing = failing;
      expect(await scanAt(START + 31 * MINUTE)).toBe(false);
      expectKept(START + 31 * MINUTE);
    }
  );

  it.each<Failing>(['receipt', 'block'])(
    'cannot be dismissed when a burn that may be its own could not be read (%s)',
    async failing => {
      minesAt(START + MINUTE);
      base.chain.failing = failing;
      expect(await scanAt(START + 31 * MINUTE)).toBe(false);
      expectKept(START + 31 * MINUTE);

      base.chain.failing = undefined;
      expect(await scanAt(START + 33 * MINUTE)).toBe(true);
      expectFollowed(BASE_BURN_TX.hash, START + MINUTE);
    }
  );

  it('cannot be dismissed on a read from before the 30 minutes', async () => {
    expect(await scanAt(START + 14 * MINUTE)).toBe(true);
    expectKept(START + 14 * MINUTE);
    expectKept(START + 31 * MINUTE);
  });

  it('can be dismissed once its L2 was read whole after 30 minutes with no burn', async () => {
    const now = START + 30 * MINUTE;
    expect(await scanAt(now)).toBe(true);
    expect(stored()).toMatchObject({ status: 'pending' });
    expect(canDismiss(stored()!, now)).toBe(true);
    store.dismiss(SCOPE, 'bundle-1');
    expect(store.getSnapshot(SCOPE)).toEqual([]);
  });

  it('cannot be dismissed on a read that starts after it was sent, while the older blocks cannot be read', async () => {
    const now = START + 21 * DAY;
    base.chain.windowAt = START + DAY;
    expect(await scanAt(now)).toBe(false);
    expectKept(now);
  });

  it('cannot be dismissed when where the read starts could not be told', async () => {
    const now = START + 31 * MINUTE;
    base.chain.failing = 'window';
    expect(await scanAt(now)).toBe(false);
    expectKept(now);

    base.chain.failing = undefined;
    expect(await scanAt(now + MINUTE)).toBe(true);
    expect(canDismiss(stored()!, now + MINUTE)).toBe(true);
  });

  it('can still be dismissed after a reload', async () => {
    const now = START + 30 * MINUTE;
    await scanAt(now);
    store = createPendingBridgeStore({ now: () => base.chain.now });
    expect(canDismiss(stored()!, now + MINUTE)).toBe(true);
  });

  it('cannot be dismissed on a read that has gone stale, until the next one', async () => {
    await scanAt(START + 30 * MINUTE);
    expect(canDismiss(stored()!, START + 74 * MINUTE)).toBe(true);
    expectKept(START + 75 * MINUTE);

    await scanAt(START + 76 * MINUTE);
    expect(canDismiss(stored()!, START + 76 * MINUTE)).toBe(true);
  });

  it('cannot be dismissed on a read of an L2 whose head is far behind', async () => {
    base.chain.headAt = START + 5 * MINUTE;
    expect(await scanAt(START + 31 * MINUTE)).toBe(true);
    expectKept(START + 31 * MINUTE);
  });

  it('is followed again when its burn mines after it could be dismissed', async () => {
    await scanAt(START + 30 * MINUTE);
    minesAt(START + 40 * MINUTE);
    expect(await scanAt(START + 60 * MINUTE)).toBe(true);
    expectFollowed(BASE_BURN_TX.hash, START + 40 * MINUTE);
  });

  it('does not take an identical burn from before it was sent', async () => {
    minesAt(START - 20 * MINUTE);
    const now = START + 30 * MINUTE;
    expect(await scanAt(now)).toBe(true);
    expect(stored()!.txHash).toBeUndefined();
    expect(canDismiss(stored()!, now)).toBe(true);
  });

  it('does not take a burn another card already follows', async () => {
    minesAt(START + MINUTE);
    const other: PendingBridge = { ...bundle({ id: BASE_BURN_TX.hash }), txHash: BASE_BURN_TX.hash };
    delete other.bundleId;
    delete other.callsId;
    store.upsert(SCOPE, other);
    const now = START + 30 * MINUTE;
    expect(await scanAt(now)).toBe(true);
    expect(stored()!.txHash).toBeUndefined();
    expect(base.client.getTransactionReceipt).not.toHaveBeenCalled();
    expect(canDismiss(stored()!, now)).toBe(true);
  });

  it.each([
    ['of another amount', { amount: AMOUNT + 10n ** 12n }],
    ['to another recipient', { recipient: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f' }]
  ])('does not take a burn %s', async (_label, patch) => {
    store = createPendingBridgeStore({ now: () => base.chain.now });
    localStorage.clear();
    store = createPendingBridgeStore({ now: () => base.chain.now });
    store.upsert(SCOPE, bundle(patch));
    minesAt(START + MINUTE);
    const now = START + 30 * MINUTE;
    expect(await scanAt(now)).toBe(true);
    expect(stored()!.txHash).toBeUndefined();
    expect(base.client.getTransactionReceipt).not.toHaveBeenCalled();
    expect(canDismiss(stored()!, now)).toBe(true);
  });

  it('cannot be dismissed while a burn that may be its own is not clearly one burn', async () => {
    base.chain.burns.push({
      hash: BASE_BURN_TX.hash,
      block: 52_837_683n,
      minedAt: START + MINUTE,
      logs: [...BASE_BURN_LOGS, ...BASE_BURN_LOGS]
    });
    await scanAt(START + 31 * MINUTE);
    expectKept(START + 31 * MINUTE);
  });

  describe('with a second identical bundle sent after it', () => {
    beforeEach(() => store.upsert(SCOPE, bundle({ id: 'bundle-2', at: START + 2 * MINUTE })));

    it('gives the earliest burn to the oldest card, and the next to the next', async () => {
      minesAt(START + 4 * MINUTE, OTHER_HASH, 52_837_700n);
      minesAt(START + 3 * MINUTE);
      expect(await scanAt(START + 6 * MINUTE)).toBe(true);
      expectFollowed(BASE_BURN_TX.hash, START + 3 * MINUTE, 'bundle-1');
      expectFollowed(OTHER_HASH, START + 4 * MINUTE, 'bundle-2');
    });

    it('gives a single burn to one card only', async () => {
      minesAt(START + 3 * MINUTE);
      expect(await scanAt(START + 6 * MINUTE)).toBe(true);
      expectFollowed(BASE_BURN_TX.hash, START + 3 * MINUTE, 'bundle-1');
      expectKept(START + 6 * MINUTE, 'bundle-2');
    });
  });

  describe('with no card waiting for a burn on the network', () => {
    it.each([
      [
        'a bundle of another route',
        () =>
          createPendingBridge({
            account: ACCOUNT,
            amount: AMOUNT,
            from: 'ethereum',
            to: 'base',
            route: nativeDepositRoute('base'),
            bundleId: 'bundle-1',
            now: START
          })
      ],
      ['a card that has its hash', () => ({ ...bundle(), txHash: BASE_BURN_TX.hash })]
    ])('reads nothing for %s', async (_label, card) => {
      localStorage.clear();
      store = createPendingBridgeStore({ now: () => base.chain.now });
      store.upsert(SCOPE, card());
      expect(await scanAt(START + 31 * MINUTE)).toBe(true);
      expect(base.client.getBlock).not.toHaveBeenCalled();
      expect(base.client.getLogs).not.toHaveBeenCalled();
    });

    it('reads nothing for a bundle of another network', async () => {
      base.chain.now = START + 31 * MINUTE;
      const done = await recoverCctpBundles({
        store,
        scope: SCOPE,
        account: ACCOUNT,
        network: 'optimism',
        client: base.client as never,
        now: () => START + 31 * MINUTE
      });
      expect(done).toBe(true);
      expect(base.client.getLogs).not.toHaveBeenCalled();
    });
  });
});
