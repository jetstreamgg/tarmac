import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import type { BridgeAdapter } from '../adapters/types';
import { createPendingBridge, type BridgeProgress } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
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
  blockTime = vi.fn(async (): Promise<number | undefined> => MINED_AT)
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
    context: { getClient: () => undefined }
  });
  return { store, added, checkProgress };
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
      now: NOW
    });
    store.upsert(SCOPE, queued);
    expect(await run([deposit()], null, store).added).toBe(0);
    // A different amount or network is another deposit.
    expect(await run([deposit({ txHash: '0xother', amount: amount + 1n })], null, store).added).toBe(1);
    expect(await run([deposit({ txHash: '0xthird', to: 'base' })], null, store).added).toBe(1);
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
      context: { getClient: () => undefined }
    });
    expect(added).toBe(0);
    expect(store.getSnapshot(SCOPE)).toEqual([launched]);
  });
});
