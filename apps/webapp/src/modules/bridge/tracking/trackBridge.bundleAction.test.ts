import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyProgress,
  canLaunchAction,
  createPendingBridge,
  recordActionSent,
  type BridgeProgress
} from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import type { PendingBridge } from '../model/types';
import { createPendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { trackBridge } from './trackBridge';

// A claim or convert sent as a wallet bundle has no hash until it mines: only the wallet can tell how it ended.

const NOW = 1_800_000_000_000;
const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const SCOPE = pendingScopeKey({ account: ACCOUNT, familyChainId: 1 });

const ready = (): PendingBridge => {
  const result = resolveBridgeRoute({ from: 'base', to: 'ethereum', amount: 1n, facts: {} });
  if (result.status !== 'ok') throw new Error(result.reason);
  const bridge = createPendingBridge({
    account: ACCOUNT,
    amount: 1n,
    from: 'base',
    to: 'ethereum',
    route: result.route,
    txHash: '0xsource',
    now: NOW
  });
  return applyProgress(bridge, { kind: 'ready', nextAction: 'claim' }, NOW);
};

describe('trackBridge: a destination action sent as a wallet bundle', () => {
  let store = createPendingBridgeStore({ now: () => NOW });
  const run = (
    readBundleAction: (
      bridge: PendingBridge,
      sent: PendingBridge['actions'][number]
    ) => Promise<BridgeProgress | null>,
    adapterProgress: BridgeProgress | null = null
  ) => {
    const adapter = { checkProgress: vi.fn(async () => adapterProgress) };
    const tracked = trackBridge({
      store,
      scope: SCOPE,
      id: '0xsource',
      now: () => NOW,
      getAdapter: () => adapter,
      context: { getClient: () => undefined },
      readSafeTx: vi.fn(async () => null),
      readSafeAction: vi.fn(async () => null),
      readBundleAction
    });
    return { adapter, tracked };
  };
  const stored = () => store.getSnapshot(SCOPE)[0];

  beforeEach(() => {
    localStorage.clear();
    store = createPendingBridgeStore({ now: () => NOW });
    store.upsert(
      SCOPE,
      recordActionSent(ready(), { action: 'claim', txHash: '0xcalls', at: NOW, bundle: true })
    );
  });

  it('confirms it from the wallet before asking the route adapter, with every transaction it ran', async () => {
    const readBundleAction = vi.fn(async (): Promise<BridgeProgress | null> => ({
      kind: 'action-confirmed',
      action: 'claim',
      txHash: '0xreceive',
      bundleTxHashes: ['0xsell']
    }));
    const { adapter, tracked } = run(readBundleAction);
    await tracked;
    expect(readBundleAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: '0xsource' }),
      expect.objectContaining({ txHash: '0xcalls', bundle: true })
    );
    expect(adapter.checkProgress).not.toHaveBeenCalled();
    expect(stored().status).toBe('claimed');
    expect(stored().actions).toEqual([
      { action: 'claim', txHash: '0xreceive', at: NOW, bundleTxHashes: ['0xsell'] }
    ]);
  });

  it('offers the action again once the wallet reports the bundle failed', async () => {
    await run(async () => ({ kind: 'action-dropped', txHash: '0xcalls' })).tracked;
    expect(stored().actions).toEqual([]);
    expect(canLaunchAction(stored())).toBe(true);
  });

  it('keeps it sent and asks the route adapter while the wallet has no answer', async () => {
    const { adapter, tracked } = run(async () => null);
    await tracked;
    expect(adapter.checkProgress).toHaveBeenCalled();
    expect(stored().actions).toMatchObject([{ txHash: '0xcalls', status: 'sent', bundle: true }]);
    expect(canLaunchAction(stored())).toBe(false);
  });

  // The claim can mine before the wallet reports it: the card stays tracked until the wallet does.
  it('keeps reading the wallet once the chain settled the bridge', async () => {
    await run(async () => null, { kind: 'arrived' }).tracked;
    expect(stored().status).toBe('claimed');
    const readBundleAction = vi.fn(async (): Promise<BridgeProgress | null> => ({
      kind: 'action-confirmed',
      action: 'claim',
      txHash: '0xreceive'
    }));
    await run(readBundleAction).tracked;
    expect(readBundleAction).toHaveBeenCalled();
    expect(stored().actions).toEqual([{ action: 'claim', txHash: '0xreceive', at: NOW }]);
  });

  it('never asks the wallet for an action sent with a hash', async () => {
    store.update(SCOPE, '0xsource', current => ({
      ...current,
      actions: [{ action: 'claim', txHash: '0xclaim', at: NOW, status: 'sent' }]
    }));
    const readBundleAction = vi.fn(async () => null);
    const { adapter, tracked } = run(readBundleAction);
    await tracked;
    expect(readBundleAction).not.toHaveBeenCalled();
    expect(adapter.checkProgress).toHaveBeenCalled();
  });
});
