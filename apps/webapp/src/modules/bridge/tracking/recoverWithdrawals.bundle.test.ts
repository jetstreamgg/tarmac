import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import type { NativeWithdrawalLookup } from '../adapters/nativeWithdrawal/lookup';
import type { BridgeAdapter } from '../adapters/types';
import { createPendingBridge, type BridgeProgress } from '../model/pendingTransitions';
import { nativeWithdrawalRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { recoverWithdrawals } from './recoverWithdrawals';

// A native withdrawal sent as a wallet bundle is one bridge: the scan that
// finds it on chain never shows it as a second card.

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const SENT_AT = NOW - 10 * MINUTE;
const MINED_AT = NOW - 9 * MINUTE;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x2546bcd3c84621e976d8185a91a922ae77ecec30';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
const AMOUNT = 5n * 10n ** 18n;
const HASH = `0x${'aa'.repeat(32)}` as Hex;
const SECOND = `0x${'bb'.repeat(32)}` as Hex;

type Overrides = { account?: string; recipient?: string; amount?: bigint; at?: number };

const bundleCard = (bundleId: string, { account, recipient, amount, at }: Overrides = {}) =>
  createPendingBridge({
    account: account ?? ACCOUNT,
    amount: amount ?? AMOUNT,
    from: 'base',
    to: 'ethereum',
    ...(recipient && { recipient }),
    route: nativeWithdrawalRoute('base'),
    bundleId,
    now: at ?? SENT_AT
  });

/** The withdrawal as its L2 receipt reads. */
const onChain = (txHash: Hex, { account, recipient, amount, at }: Overrides = {}) =>
  createPendingBridge({
    account: account ?? ACCOUNT,
    amount: amount ?? AMOUNT,
    from: 'base',
    to: 'ethereum',
    ...(recipient && { recipient }),
    route: nativeWithdrawalRoute('base'),
    txHash,
    now: at ?? MINED_AT
  });

const run = (
  store: ReturnType<typeof createPendingBridgeStore>,
  found: PendingBridge[],
  progress: BridgeProgress | null = null
) =>
  recoverWithdrawals({
    store,
    scope: SCOPE,
    withdrawals: found.map((bridge, i) => ({ txHash: bridge.txHash as Hex, blockNumber: BigInt(100 + i) })),
    lookup: async (txHash): Promise<NativeWithdrawalLookup> => {
      const bridge = found.find(entry => entry.txHash === txHash);
      return bridge ? { status: 'found', bridge } : { status: 'refused', reason: 'not-found' };
    },
    now: () => NOW,
    adapter: { checkProgress: vi.fn<BridgeAdapter['checkProgress']>(async () => progress) },
    context: { getClient: () => undefined },
    settled: new Set<string>()
  });

const stored = (store: ReturnType<typeof createPendingBridgeStore>) => store.getSnapshot(SCOPE);

describe('a native withdrawal sent as a wallet bundle, found by the scan', () => {
  beforeEach(() => localStorage.clear());

  it('is one card, the bundle one, now tracked by its hash', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));

    expect(await run(store, [onChain(HASH)])).toBe(0);

    expect(stored(store)).toHaveLength(1);
    expect(stored(store)[0]).toMatchObject({ id: 'bundle-1', bundleId: 'bundle-1', txHash: HASH });
  });

  it('stays one card on every later scan', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));

    await run(store, [onChain(HASH)]);
    await run(store, [onChain(HASH)], { kind: 'ready', nextAction: 'prove' });

    expect(stored(store)).toHaveLength(1);
  });

  it('is one card when it pays the recipient the bundle named', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1', { recipient: OTHER }));

    await run(store, [onChain(HASH, { recipient: OTHER })]);

    expect(stored(store)).toHaveLength(1);
    expect(stored(store)[0]).toMatchObject({ bundleId: 'bundle-1', txHash: HASH, recipient: OTHER });
  });

  it('is two cards for two bundles of the same amount, each with its own withdrawal', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-late', { at: SENT_AT + MINUTE }));
    store.upsert(SCOPE, bundleCard('bundle-early'));

    await run(store, [onChain(HASH), onChain(SECOND, { at: MINED_AT + MINUTE })]);

    const cards = stored(store);
    expect(cards).toHaveLength(2);
    // The oldest card takes the earliest withdrawal.
    expect(cards.find(card => card.id === 'bundle-early')?.txHash).toBe(HASH);
    expect(cards.find(card => card.id === 'bundle-late')?.txHash).toBe(SECOND);
  });
});

describe('a withdrawal that is not the bundle', () => {
  beforeEach(() => localStorage.clear());

  it.each([
    ['of another amount', { amount: AMOUNT + 1n }],
    ['to another recipient', { recipient: OTHER }],
    ['sent by another wallet to this one', { account: OTHER, recipient: ACCOUNT }],
    ['mined well before the bundle was sent', { at: SENT_AT - 2 * 60 * MINUTE }]
  ] as [string, Overrides][])(
    '%s gets its own card and leaves the bundle card as it was',
    async (_label, other) => {
      const store = createPendingBridgeStore({ now: () => NOW });
      const card = bundleCard('bundle-1');
      store.upsert(SCOPE, card);

      expect(await run(store, [onChain(HASH, other)])).toBe(1);

      const cards = stored(store);
      expect(cards).toHaveLength(2);
      expect(cards.find(entry => entry.id === 'bundle-1')).toEqual(card);
      expect(cards.find(entry => entry.id === HASH)).toMatchObject({ txHash: HASH });
    }
  );

  it('never fills a bundle card of another route', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    const deposit = { ...bundleCard('bundle-1'), from: 'ethereum', to: 'base' } as PendingBridge;
    store.upsert(SCOPE, deposit);

    expect(await run(store, [onChain(HASH)])).toBe(1);
    expect(stored(store).find(entry => entry.id === 'bundle-1')).toEqual(deposit);
  });

  it('never fills a bundle card that already has its hash', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));
    await run(store, [onChain(HASH)]);

    expect(await run(store, [onChain(HASH), onChain(SECOND, { at: MINED_AT + MINUTE })])).toBe(1);

    const cards = stored(store);
    expect(cards).toHaveLength(2);
    expect(cards.find(card => card.id === 'bundle-1')?.txHash).toBe(HASH);
  });
});

describe('a bundled withdrawal the scan finds already finalized', () => {
  beforeEach(() => localStorage.clear());

  it('gives the bundle card its hash, so its tracker reads that it arrived', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, bundleCard('bundle-1'));

    expect(await run(store, [onChain(HASH)], { kind: 'arrived' })).toBe(0);

    expect(stored(store)).toHaveLength(1);
    expect(stored(store)[0]).toMatchObject({ bundleId: 'bundle-1', txHash: HASH });
  });
});
