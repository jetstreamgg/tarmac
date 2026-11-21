/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridge } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { cctpSwapStore } from '../store/cctpSwapStore';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useBridgeTracker } from './useBridgeTracker';

// A swap is kept until its burn mined: then nothing is left to continue.

const mocks = vi.hoisted(() => ({ address: undefined as string | undefined, checkProgress: vi.fn() }));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => 1,
  useChains: () => [{ id: 1 }],
  useConfig: () => ({})
}));
vi.mock('../adapters/registry', () => ({
  getBridgeAdapter: () => ({ checkProgress: mocks.checkProgress })
}));
vi.mock('../adapters/safe', () => ({ readSafeTxProgress: vi.fn() }));

const NOW = 1_800_000_000_000;
const SWAP_HASH = '0x' + 'ab'.repeat(32);
const BURN_HASH = '0x' + 'cd'.repeat(32);

let accountSeq = 0;
const scope = () => pendingScopeKey({ account: mocks.address!, familyChainId: 1 });

const seedCard = (ids: { txHash?: string; bundleId?: string; callsId?: string }) => {
  const resolved = resolveBridgeRoute({ from: 'base', to: 'ethereum', amount: 1n, facts: {} });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const bridge = createPendingBridge({
    account: mocks.address!,
    amount: 1n,
    from: 'base',
    to: 'ethereum',
    route: resolved.route,
    ...ids,
    now: NOW
  });
  expect(bridge.routeKind).toBe('cctp');
  pendingBridgeStore.upsert(scope(), bridge);
  return bridge;
};
const seedSwap = (burn?: string) =>
  cctpSwapStore.record(scope(), {
    swapTxHash: SWAP_HASH,
    network: 'base',
    usdcAmount: 1n,
    recipient: mocks.address!,
    at: NOW,
    ...(burn && { burn })
  });
const swaps = () => cctpSwapStore.getSnapshot(scope()).map(swap => swap.swapTxHash);

const renderTracker = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useBridgeTracker(), { wrapper });
};
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('useBridgeTracker: unfinished CCTP swaps', () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.address = `0x${(2000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.checkProgress.mockReset();
  });

  it.each([{ kind: 'waiting' }, { kind: 'ready', nextAction: 'claim' }, { kind: 'arrived' }])(
    'drops the swap once the chain shows its burn mined ($kind)',
    async progress => {
      mocks.checkProgress.mockResolvedValue(progress);
      seedSwap(BURN_HASH);
      seedCard({ txHash: BURN_HASH });
      renderTracker();
      await waitFor(() => expect(swaps()).toEqual([]));
    }
  );

  it('drops a continued swap once the bundle that burned it mined', async () => {
    mocks.checkProgress.mockResolvedValue({ kind: 'waiting' });
    seedSwap('calls-1');
    const bridge = seedCard({ bundleId: 'bundle-1', callsId: 'calls-1' });
    pendingBridgeStore.resolveBundle(scope(), bridge.id, BURN_HASH);
    renderTracker();
    await waitFor(() => expect(swaps()).toEqual([]));
  });

  it('keeps the swap while its burn is unconfirmed or reverted, and a swap of another burn', async () => {
    mocks.checkProgress.mockResolvedValueOnce(null);
    seedSwap(BURN_HASH);
    seedCard({ txHash: BURN_HASH });
    renderTracker();
    await waitFor(() => expect(mocks.checkProgress).toHaveBeenCalled());
    await settle();
    expect(swaps()).toEqual([SWAP_HASH]);

    mocks.address = `0x${(2000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.checkProgress.mockReset();
    mocks.checkProgress.mockResolvedValue({ kind: 'failed', reason: 'source-tx-reverted' });
    seedSwap(BURN_HASH);
    seedCard({ txHash: BURN_HASH });
    renderTracker();
    await waitFor(() => expect(mocks.checkProgress).toHaveBeenCalled());
    await settle();
    expect(swaps()).toEqual([SWAP_HASH]);

    mocks.address = `0x${(2000 + ++accountSeq).toString(16).padStart(40, '0')}`;
    mocks.checkProgress.mockReset();
    mocks.checkProgress.mockResolvedValue({ kind: 'waiting' });
    seedSwap('0x' + '12'.repeat(32));
    seedCard({ txHash: BURN_HASH });
    renderTracker();
    await waitFor(() => expect(mocks.checkProgress).toHaveBeenCalled());
    await settle();
    expect(swaps()).toEqual([SWAP_HASH]);
  });
});
