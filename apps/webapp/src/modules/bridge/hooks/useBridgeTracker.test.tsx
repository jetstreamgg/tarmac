/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyProgress, createPendingBridge } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useBridgeTracker } from './useBridgeTracker';

const mocks = vi.hoisted(() => ({
  address: undefined as string | undefined,
  checkProgress: vi.fn(),
  readSafeTxProgress: vi.fn()
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => 1
}));
vi.mock('../adapters/registry', () => ({
  getBridgeAdapter: () => ({ checkProgress: mocks.checkProgress })
}));
vi.mock('../adapters/safe', () => ({ readSafeTxProgress: mocks.readSafeTxProgress }));

const NOW = 1_800_000_000_000;

let accountSeq = 0;
const nextAccount = () => `0x${(1000 + ++accountSeq).toString(16).padStart(40, '0')}`;
const scope = () => pendingScopeKey({ account: mocks.address!, familyChainId: 1 });

const seed = (ids: { txHash?: string; safeTxHash?: string }) => {
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
  pendingBridgeStore.upsert(scope(), bridge);
  return bridge;
};

const renderTracker = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useBridgeTracker(), { wrapper });
};

const stored = (id: string) => pendingBridgeStore.getSnapshot(scope()).find(bridge => bridge.id === id);

describe('useBridgeTracker', () => {
  beforeEach(() => {
    mocks.address = nextAccount();
    mocks.checkProgress.mockReset();
    mocks.readSafeTxProgress.mockReset();
  });

  it('writes what the route adapter reports into the store', async () => {
    mocks.checkProgress.mockResolvedValue({ kind: 'ready', nextAction: 'claim' });
    seed({ txHash: '0xsource' });
    renderTracker();
    await waitFor(() => expect(stored('0xsource')).toMatchObject({ status: 'ready', nextAction: 'claim' }));
  });

  it('asks the Safe service on the source chain for a queued Safe bridge', async () => {
    mocks.readSafeTxProgress.mockResolvedValue({ kind: 'source-executed', txHash: '0xexec' });
    seed({ safeTxHash: '0xsafe' });
    renderTracker();
    await waitFor(() => expect(stored('0xsafe')).toMatchObject({ txHash: '0xexec' }));
    expect(mocks.readSafeTxProgress).toHaveBeenCalledWith({ chainId: 8453, safeTxHash: '0xsafe' });
    expect(mocks.checkProgress).not.toHaveBeenCalled();
  });

  it('does not poll settled bridges or a disconnected wallet', async () => {
    const bridge = seed({ txHash: '0xdone' });
    pendingBridgeStore.update(scope(), bridge.id, entry => applyProgress(entry, { kind: 'arrived' }, NOW));
    renderTracker();
    mocks.address = undefined;
    renderTracker();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(mocks.checkProgress).not.toHaveBeenCalled();
  });
});
