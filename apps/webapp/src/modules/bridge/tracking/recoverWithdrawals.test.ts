import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import type { NativeWithdrawalLookup } from '../adapters/nativeWithdrawal/lookup';
import type { BridgeAdapter } from '../adapters/types';
import { createPendingBridge, type BridgeProgress } from '../model/pendingTransitions';
import { nativeWithdrawalRoute } from '../model/resolveRoute';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { recoverWithdrawals } from './recoverWithdrawals';

const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });
const HASH = '0x00000000000000000000000000000000000000000000000000000000000000aa' as Hex;

const withdrawal = (txHash: Hex = HASH) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: nativeWithdrawalRoute('base'),
    txHash,
    now: NOW - 60_000
  });

const run = ({
  hashes = [HASH],
  found = (txHash: Hex): NativeWithdrawalLookup => ({ status: 'found', bridge: withdrawal(txHash) }),
  progress = null as BridgeProgress | null,
  store = createPendingBridgeStore({ now: () => NOW }),
  settled = new Set<string>()
} = {}) => {
  const lookup = vi.fn(async (txHash: Hex) => found(txHash));
  const checkProgress = vi.fn<BridgeAdapter['checkProgress']>(async () => progress);
  const added = recoverWithdrawals({
    store,
    scope: SCOPE,
    withdrawals: hashes.map((txHash, i) => ({ txHash, blockNumber: BigInt(i) })),
    lookup,
    now: () => NOW,
    adapter: { checkProgress },
    context: { getClient: () => undefined },
    settled
  });
  return { store, added, lookup, checkProgress, settled };
};

describe('recoverWithdrawals', () => {
  beforeEach(() => localStorage.clear());

  it('adds a withdrawal the store lacks, with its progress applied', async () => {
    const { store, added } = run({ progress: { kind: 'ready', nextAction: 'prove' } });
    expect(await added).toBe(1);
    expect(store.getSnapshot(SCOPE)).toMatchObject([
      {
        txHash: HASH,
        from: 'base',
        to: 'ethereum',
        routeKind: 'native',
        status: 'ready',
        nextAction: 'prove'
      }
    ]);
  });

  it('adds it as pending when its progress is unknown', async () => {
    const { store, added } = run();
    expect(await added).toBe(1);
    expect(store.getSnapshot(SCOPE)[0]).toMatchObject({ status: 'pending' });
  });

  it('skips one already stored, by its hash, without reading it', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(SCOPE, withdrawal(HASH.toUpperCase().replace('0X', '0x') as Hex));
    const { added, lookup } = run({ store });
    expect(await added).toBe(0);
    expect(lookup).not.toHaveBeenCalled();
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
  });

  it.each([{ kind: 'arrived' }, { kind: 'failed', reason: 'source-tx-reverted' }] as const)(
    'adds nothing for one already settled (%o) and never reads it again',
    async progress => {
      const first = run({ progress });
      expect(await first.added).toBe(0);
      expect(first.store.getSnapshot(SCOPE)).toEqual([]);
      const again = run({ progress, settled: first.settled });
      expect(await again.added).toBe(0);
      expect(again.lookup).not.toHaveBeenCalled();
    }
  );

  it('never reads again a transaction the lookup refuses', async () => {
    const first = run({ found: () => ({ status: 'refused', reason: 'not-a-bridge' }) });
    expect(await first.added).toBe(0);
    expect(first.settled.has(HASH)).toBe(true);
  });

  it('keeps going past a read error, and tries it again next run', async () => {
    const OTHER = '0x00000000000000000000000000000000000000000000000000000000000000bb' as Hex;
    const { store, added, settled } = run({
      hashes: [HASH, OTHER],
      found: txHash => {
        if (txHash === HASH) throw new Error('rpc down');
        return { status: 'found', bridge: withdrawal(txHash) };
      }
    });
    expect(await added).toBe(1);
    expect(store.getSnapshot(SCOPE).map(bridge => bridge.txHash)).toEqual([OTHER]);
    expect(settled.has(HASH)).toBe(false);
  });

  it('does not add one the launch stored while it was being read', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    const { added } = run({
      store,
      found: txHash => {
        store.upsert(SCOPE, withdrawal(txHash));
        return { status: 'found', bridge: withdrawal(txHash) };
      }
    });
    expect(await added).toBe(0);
    expect(store.getSnapshot(SCOPE)).toHaveLength(1);
  });
});
