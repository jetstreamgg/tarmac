import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyProgress,
  canLaunchAction,
  createPendingBridge,
  recordAction,
  recordActionSent
} from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { mockAdapter, MOCK_STAGE_MS } from '../adapters/mockAdapter';
import type { BridgeAdapter } from '../adapters/types';
import type { BridgeProgress } from '../model/pendingTransitions';
import type { BridgeRoute } from '../model/types';
import { trackBridge } from './trackBridge';

const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });

const cctpRoute = (): BridgeRoute => {
  const result = resolveBridgeRoute({ from: 'base', to: 'ethereum', amount: 1n, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  return result.route;
};

const seed = (ids: { txHash?: string; safeTxHash?: string }) =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 1n,
    from: 'base',
    to: 'ethereum',
    route: cctpRoute(),
    ...ids,
    now: NOW
  });

describe('trackBridge', () => {
  let now = NOW;
  let store = createPendingBridgeStore({ now: () => now });
  const run = (
    id: string,
    adapter: BridgeAdapter = mockAdapter,
    readSafeTx = vi.fn(async (): Promise<BridgeProgress | null> => null),
    readSafeAction = vi.fn(async (): Promise<BridgeProgress | null> => null)
  ) =>
    trackBridge({
      store,
      scope: SCOPE,
      id,
      now: () => now,
      getAdapter: () => adapter,
      context: { getClient: () => undefined },
      readSafeTx,
      readSafeAction
    });

  const seedSentClaim = (safe: boolean) => {
    const ready = applyProgress(seed({ txHash: '0xsource' }), { kind: 'ready', nextAction: 'claim' }, NOW);
    store.upsert(
      SCOPE,
      recordActionSent(ready, {
        action: 'claim',
        txHash: '0xsafeclaim',
        at: NOW,
        ...(safe && { safe: true })
      })
    );
  };

  beforeEach(() => {
    now = NOW;
    localStorage.clear();
    store = createPendingBridgeStore({ now: () => now });
  });

  it('resolves a queued Safe transaction before asking the route adapter', async () => {
    store.upsert(SCOPE, seed({ safeTxHash: '0xsafe' }));
    const adapter = { checkProgress: vi.fn(async () => null) };
    const readSafeTx = vi.fn(async () => ({ kind: 'source-executed' as const, txHash: '0xexec' }));
    await run('0xsafe', adapter, readSafeTx);
    expect(readSafeTx).toHaveBeenCalledWith(expect.objectContaining({ safeTxHash: '0xsafe' }));
    expect(adapter.checkProgress).not.toHaveBeenCalled();
    expect(store.getSnapshot(SCOPE)[0]).toMatchObject({ id: '0xsafe', txHash: '0xexec', status: 'pending' });
  });

  it('a replaced Safe transaction fails the bridge', async () => {
    store.upsert(SCOPE, seed({ safeTxHash: '0xsafe' }));
    await run(
      '0xsafe',
      mockAdapter,
      vi.fn(async () => ({ kind: 'failed' as const, reason: 'safe-tx-replaced' }))
    );
    expect(store.getSnapshot(SCOPE)[0]).toMatchObject({
      status: 'failed',
      failureReason: 'safe-tx-replaced'
    });
  });

  it('applies what the adapter reports once the source tx is known', async () => {
    store.upsert(SCOPE, seed({ txHash: '0xsource' }));
    expect(await run('0xsource')).toBeNull();
    now = NOW + MOCK_STAGE_MS;
    expect(await run('0xsource')).toEqual({ kind: 'ready', nextAction: 'claim' });
    expect(store.getSnapshot(SCOPE)[0]).toMatchObject({ status: 'ready', nextAction: 'claim' });
  });

  it('does not rewrite the store when a poll reports the same state', async () => {
    store.upsert(SCOPE, seed({ txHash: '0xsource' }));
    now = NOW + MOCK_STAGE_MS;
    await run('0xsource');
    const listener = vi.fn();
    store.subscribe(listener);
    await run('0xsource');
    expect(listener).not.toHaveBeenCalled();
  });

  it('drops a poll result when the bridge changed while the poll was in flight', async () => {
    const withdrawal = resolveBridgeRoute({
      from: 'base',
      to: 'ethereum',
      amount: 1n,
      facts: { cctp: { isOpen: false } }
    });
    if (withdrawal.status !== 'ok') throw new Error(withdrawal.reason);
    const bridge = createPendingBridge({
      account: ACCOUNT,
      amount: 1n,
      from: 'base',
      to: 'ethereum',
      route: withdrawal.route,
      txHash: '0xsource',
      now: NOW
    });
    store.upsert(SCOPE, applyProgress(bridge, { kind: 'ready', nextAction: 'prove' }, NOW));
    const adapter = {
      checkProgress: vi.fn(async () => {
        // The user's prove lands while this poll still reports the old state.
        store.update(SCOPE, '0xsource', entry =>
          recordAction(entry, { action: 'prove', txHash: '0xprove', at: now })
        );
        return { kind: 'ready' as const, nextAction: 'prove' as const };
      })
    };
    expect(await run('0xsource', adapter)).toBeNull();
    expect(store.getSnapshot(SCOPE)[0]).toMatchObject({ status: 'pending', nextAction: 'finalize' });
  });

  it('drops a Safe action the service rules out, so it can be sent again', async () => {
    seedSentClaim(true);
    const adapter = { checkProgress: vi.fn(async () => null) };
    const readSafeAction = vi.fn(async () => ({ kind: 'action-dropped' as const, txHash: '0xsafeclaim' }));
    await run('0xsource', adapter, undefined, readSafeAction);
    expect(readSafeAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: '0xsource' }),
      expect.objectContaining({ txHash: '0xsafeclaim', safe: true })
    );
    expect(store.getSnapshot(SCOPE)[0].actions).toEqual([]);
    expect(canLaunchAction(store.getSnapshot(SCOPE)[0])).toBe(true);
  });

  it('confirms a Safe action under the hash it executed with', async () => {
    seedSentClaim(true);
    await run(
      '0xsource',
      mockAdapter,
      undefined,
      vi.fn(async () => ({
        kind: 'action-confirmed' as const,
        action: 'claim' as const,
        txHash: '0xexec',
        at: NOW
      }))
    );
    expect(store.getSnapshot(SCOPE)[0]).toMatchObject({
      status: 'claimed',
      actions: [{ action: 'claim', txHash: '0xexec', at: NOW }]
    });
  });

  it('asks the route adapter while a Safe action still waits for its signers', async () => {
    seedSentClaim(true);
    const adapter = { checkProgress: vi.fn(async () => ({ kind: 'arrived' as const })) };
    await run('0xsource', adapter);
    expect(adapter.checkProgress).toHaveBeenCalled();
    expect(store.getSnapshot(SCOPE)[0]).toMatchObject({ status: 'claimed' });
  });

  it('leaves an action sent from a regular wallet to the route adapter', async () => {
    seedSentClaim(false);
    const readSafeAction = vi.fn(async () => ({ kind: 'action-dropped' as const, txHash: '0xsafeclaim' }));
    await run('0xsource', mockAdapter, undefined, readSafeAction);
    expect(readSafeAction).not.toHaveBeenCalled();
    expect(store.getSnapshot(SCOPE)[0].actions).toHaveLength(1);
  });

  it('skips settled and unknown bridges', async () => {
    const adapter = { checkProgress: vi.fn(async () => ({ kind: 'arrived' as const })) };
    store.upsert(SCOPE, { ...seed({ txHash: '0xsource' }), status: 'claimed', settledAt: NOW });
    expect(await run('0xsource', adapter)).toBeNull();
    expect(await run('0xmissing', adapter)).toBeNull();
    expect(adapter.checkProgress).not.toHaveBeenCalled();
  });

  describe('a settled CCTP bridge with a convert sent', () => {
    const seedClaimed = (convert?: { safe: boolean }) => {
      const ready = applyProgress(seed({ txHash: '0xsource' }), { kind: 'ready', nextAction: 'claim' }, NOW);
      const claimed = recordAction(ready, { action: 'claim', txHash: '0xclaim', at: NOW });
      store.upsert(
        SCOPE,
        convert
          ? recordActionSent(claimed, {
              action: 'convert',
              txHash: '0xsell',
              at: NOW,
              ...(convert.safe && { safe: true })
            })
          : claimed
      );
    };
    const convertOf = () => store.getSnapshot(SCOPE)[0].actions.filter(action => action.action === 'convert');

    it('asks the route adapter, which settles it', async () => {
      seedClaimed({ safe: false });
      const adapter = {
        checkProgress: vi.fn(async () => ({
          kind: 'action-confirmed' as const,
          action: 'convert' as const,
          txHash: '0xsell'
        }))
      };
      await run('0xsource', adapter);
      expect(adapter.checkProgress).toHaveBeenCalledTimes(1);
      expect(convertOf()).toEqual([{ action: 'convert', txHash: '0xsell', at: NOW }]);
      expect(store.getSnapshot(SCOPE)[0].status).toBe('claimed');
    });

    it("reads a Safe's convert from the Safe service", async () => {
      seedClaimed({ safe: true });
      const adapter = { checkProgress: vi.fn(async () => null) };
      const readSafeAction = vi.fn(async () => ({ kind: 'action-dropped' as const, txHash: '0xsell' }));
      await run('0xsource', adapter, undefined, readSafeAction);
      expect(readSafeAction).toHaveBeenCalledTimes(1);
      expect(adapter.checkProgress).not.toHaveBeenCalled();
      expect(convertOf()).toEqual([]);
    });

    it('is not polled once nothing is sent', async () => {
      seedClaimed();
      const adapter = { checkProgress: vi.fn(async () => null) };
      await expect(run('0xsource', adapter)).resolves.toBeNull();
      expect(adapter.checkProgress).not.toHaveBeenCalled();
    });
  });
});
