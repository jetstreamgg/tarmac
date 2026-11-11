import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import type { BridgeAdapter } from '../adapters/types';
import { createPendingBridge, type BridgeProgress } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { recoverDeposits } from './recoverDeposits';

const NOW = 1_800_000_000_000;
const MINED_AT = NOW - 3 * 60 * 60_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const OTHER = '0x2546BcD3c84621e976D8185a91A922aE77ECEc30';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });

const deposit = (overrides: Partial<DiscoveredDeposit> = {}): DiscoveredDeposit => ({
  txHash: '0xdeposit',
  blockNumber: 100n,
  to: 'arbitrum',
  amount: 5n * 10n ** 18n,
  recipient: ACCOUNT,
  ...overrides
});

const run = (
  deposits: DiscoveredDeposit[],
  progress: BridgeProgress | null,
  store = createPendingBridgeStore({ now: () => NOW }),
  blockTime = vi.fn(async (): Promise<number | undefined> => MINED_AT),
  settled = new Set<string>()
) => {
  const checkProgress = vi.fn<BridgeAdapter['checkProgress']>(async () => progress);
  const added = recoverDeposits({
    store,
    scope: SCOPE,
    account: ACCOUNT,
    deposits,
    now: () => NOW,
    blockTime,
    adapter: { checkProgress },
    context: { getClient: () => undefined },
    settled
  });
  return { store, added, checkProgress, settled };
};

describe('recoverDeposits', () => {
  beforeEach(() => localStorage.clear());

  it('adds a deposit whose ticket needs a redeem, started when it mined', async () => {
    const { store, added } = run([deposit()], { kind: 'ready', nextAction: 'redeem' });
    expect(await added).toBe(1);
    const [bridge] = store.getSnapshot(SCOPE);
    expect(bridge).toMatchObject({
      id: '0xdeposit',
      txHash: '0xdeposit',
      from: 'ethereum',
      to: 'arbitrum',
      routeKind: 'native',
      startedAt: MINED_AT,
      nextAction: 'redeem'
    });
    expect(bridge.recipient).toBeUndefined();
  });

  it('adds one with no progress yet as pending', async () => {
    const { store, added } = run([deposit({ to: 'base' })], null);
    expect(await added).toBe(1);
    expect(store.getSnapshot(SCOPE)).toMatchObject([{ status: 'pending', to: 'base' }]);
  });

  it('adds an expired ticket so its card explains what happened', async () => {
    const { store, added } = run([deposit()], { kind: 'expired' });
    expect(await added).toBe(1);
    expect(store.getSnapshot(SCOPE)).toMatchObject([{ status: 'expired' }]);
  });

  it('adds nothing for a deposit that arrived or moved no funds', async () => {
    for (const progress of [{ kind: 'arrived' }, { kind: 'failed', reason: 'reverted' }] as const) {
      localStorage.clear();
      const { store, added } = run([deposit()], progress);
      expect(await added).toBe(0);
      expect(store.getSnapshot(SCOPE)).toEqual([]);
    }
  });

  it('never checks a deposit that arrived or moved no funds again', async () => {
    for (const progress of [{ kind: 'arrived' }, { kind: 'failed', reason: 'reverted' }] as const) {
      localStorage.clear();
      const first = run([deposit({ txHash: '0xDEPOSIT' })], progress);
      await first.added;
      expect(first.settled).toEqual(new Set(['0xdeposit']));
      const again = run([deposit()], progress, undefined, undefined, first.settled);
      expect(await again.added).toBe(0);
      expect(again.checkProgress).not.toHaveBeenCalled();
    }
  });

  it('checks a deposit still under way again on the next run', async () => {
    for (const progress of [null, { kind: 'ready', nextAction: 'redeem' }] as const) {
      localStorage.clear();
      const { added, settled } = run([deposit()], progress);
      await added;
      expect(settled.size).toBe(0);
    }
  });

  it('checks the deposits in parallel', async () => {
    let release = () => {};
    const gate = new Promise<void>(resolve => (release = resolve));
    const checkProgress = vi.fn<BridgeAdapter['checkProgress']>(async () => {
      await gate;
      return null;
    });
    const store = createPendingBridgeStore({ now: () => NOW });
    const added = recoverDeposits({
      store,
      scope: SCOPE,
      account: ACCOUNT,
      deposits: [deposit(), deposit({ txHash: '0xsecond', to: 'base' })],
      now: () => NOW,
      blockTime: async () => MINED_AT,
      adapter: { checkProgress },
      context: { getClient: () => undefined },
      settled: new Set()
    });
    await vi.waitFor(() => expect(checkProgress).toHaveBeenCalledTimes(2));
    release();
    expect(await added).toBe(2);
    expect(store.getSnapshot(SCOPE)).toHaveLength(2);
  });

  it('keeps a recipient other than the account', async () => {
    const { store } = run([deposit({ recipient: OTHER })], null);
    await vi.waitFor(() => expect(store.getSnapshot(SCOPE)).toHaveLength(1));
    expect(store.getSnapshot(SCOPE)[0].recipient).toBe(OTHER);
  });

  it('falls back to now when the block time cannot be read', async () => {
    const { store, added } = run(
      [deposit()],
      null,
      undefined,
      vi.fn(async () => undefined)
    );
    await added;
    expect(store.getSnapshot(SCOPE)[0].startedAt).toBe(NOW);
  });

  it('skips a deposit already stored, by id or tx hash in any case', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    const stored = createPendingBridge({
      account: ACCOUNT,
      amount: 1n,
      from: 'ethereum',
      to: 'arbitrum',
      route: nativeDepositRoute('arbitrum'),
      txHash: '0xDEPOSIT',
      now: NOW
    });
    store.upsert(SCOPE, stored);
    const { added, checkProgress } = run([deposit()], { kind: 'ready', nextAction: 'redeem' }, store);
    expect(await added).toBe(0);
    expect(checkProgress).not.toHaveBeenCalled();
    expect(store.getSnapshot(SCOPE)).toEqual([stored]);
  });

  it('skips a deposit a queued Safe bridge of the same amount may be', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    const amount = deposit().amount;
    const queued = createPendingBridge({
      account: ACCOUNT,
      amount,
      from: 'ethereum',
      to: 'arbitrum',
      route: nativeDepositRoute('arbitrum'),
      safeTxHash: '0xsafe',
      now: MINED_AT
    });
    store.upsert(SCOPE, queued);
    expect(await run([deposit()], null, store).added).toBe(0);
    // A different amount or network is another deposit.
    expect(await run([deposit({ txHash: '0xother', amount: amount + 1n })], null, store).added).toBe(1);
    expect(await run([deposit({ txHash: '0xthird', to: 'base' })], null, store).added).toBe(1);
  });

  describe('a queued Safe bridge never hides a deposit it cannot be', () => {
    const queuedAt = (startedAt: number, overrides: Partial<PendingBridge> = {}) => {
      const store = createPendingBridgeStore({ now: () => NOW });
      store.upsert(SCOPE, {
        ...createPendingBridge({
          account: ACCOUNT,
          amount: deposit().amount,
          from: 'ethereum',
          to: 'arbitrum',
          route: nativeDepositRoute('arbitrum'),
          safeTxHash: '0xsafe',
          now: startedAt
        }),
        ...overrides
      });
      return store;
    };

    it('a deposit mined long before the Safe bridge was queued', async () => {
      const store = queuedAt(MINED_AT + 24 * 60 * 60_000);
      expect(await run([deposit()], null, store).added).toBe(1);
    });

    it('a second deposit of the same amount', async () => {
      const store = queuedAt(MINED_AT - 60_000);
      const deposits = [deposit(), deposit({ txHash: '0xsecond', blockNumber: 101n })];
      expect(await run(deposits, null, store).added).toBe(1);
      expect(store.getSnapshot(SCOPE).filter(bridge => bridge.txHash)).toHaveLength(1);
    });

    it('once the Safe bridge settled', async () => {
      const store = queuedAt(MINED_AT - 60_000, { status: 'failed', settledAt: NOW });
      expect(await run([deposit()], null, store).added).toBe(1);
    });
  });

  it('does not overwrite a bridge stored while it was reading', async () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    const launched = createPendingBridge({
      account: ACCOUNT,
      amount: 1n,
      from: 'ethereum',
      to: 'arbitrum',
      route: nativeDepositRoute('arbitrum'),
      txHash: '0xdeposit',
      now: NOW
    });
    const checkProgress = vi.fn<BridgeAdapter['checkProgress']>(async () => {
      store.upsert(SCOPE, launched);
      return { kind: 'ready', nextAction: 'redeem' };
    });
    const added = await recoverDeposits({
      store,
      scope: SCOPE,
      account: ACCOUNT,
      deposits: [deposit()],
      now: () => NOW,
      blockTime: async () => MINED_AT,
      adapter: { checkProgress },
      context: { getClient: () => undefined },
      settled: new Set()
    });
    expect(added).toBe(0);
    expect(store.getSnapshot(SCOPE)).toEqual([launched]);
  });
});

describe('recoverDeposits, with the Safe transactions each deposit executed', () => {
  beforeEach(() => localStorage.clear());

  const queued = () => {
    const store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(
      SCOPE,
      createPendingBridge({
        account: ACCOUNT,
        amount: deposit().amount,
        from: 'ethereum',
        to: 'arbitrum',
        route: nativeDepositRoute('arbitrum'),
        safeTxHash: '0xSAFE',
        now: MINED_AT - 10 * 60_000
      })
    );
    return store;
  };
  const recover = (
    store: ReturnType<typeof queued>,
    deposits: DiscoveredDeposit[],
    executed: (txHash: string) => Promise<string[] | undefined>
  ) =>
    recoverDeposits({
      store,
      scope: SCOPE,
      account: ACCOUNT,
      deposits,
      now: () => NOW,
      blockTime: async () => MINED_AT,
      adapter: { checkProgress: async () => ({ kind: 'ready', nextAction: 'redeem' }) },
      context: { getClient: () => undefined },
      settled: new Set(),
      executedSafeTxHashes: executed
    });

  it('adds a deposit that executed another Safe transaction than the queued bridge', async () => {
    const store = queued();
    expect(await recover(store, [deposit()], async () => ['0xother'])).toBe(1);
    expect(store.getSnapshot(SCOPE).map(bridge => bridge.txHash)).toContain('0xdeposit');
  });

  it('lets the queued bridge cover the next deposit when the first executed another Safe transaction', async () => {
    const store = queued();
    const deposits = [deposit(), deposit({ txHash: '0xsecond', blockNumber: 101n })];
    const executed = async (txHash: string) => (txHash === '0xdeposit' ? ['0xother'] : ['0xsafe']);
    expect(await recover(store, deposits, executed)).toBe(1);
    expect(store.getSnapshot(SCOPE).map(bridge => bridge.txHash)).toContain('0xdeposit');
  });

  it("still skips the deposit that executed the queued bridge's Safe transaction", async () => {
    expect(await recover(queued(), [deposit()], async () => ['0xsafe'])).toBe(0);
  });

  it("still skips a deposit whose Safe transactions can't be read", async () => {
    expect(await recover(queued(), [deposit()], async () => undefined)).toBe(0);
    expect(await recover(queued(), [deposit()], async () => [])).toBe(0);
  });

  it("gives the queued bridge its own deposit over an earlier one whose Safe transactions can't be read", async () => {
    const store = queued();
    const deposits = [deposit(), deposit({ txHash: '0xsecond', blockNumber: 101n })];
    const executed = async (txHash: string) => (txHash === '0xdeposit' ? undefined : ['0xsafe']);
    expect(await recover(store, deposits, executed)).toBe(1);
    expect(
      store
        .getSnapshot(SCOPE)
        .filter(bridge => bridge.txHash)
        .map(bridge => bridge.txHash)
    ).toEqual(['0xdeposit']);
  });

  it('reads only the deposits a queued bridge may be', async () => {
    const executed = vi.fn(async () => ['0xother']);
    await recover(queued(), [deposit({ to: 'base' })], executed);
    expect(executed).not.toHaveBeenCalled();
  });
});
