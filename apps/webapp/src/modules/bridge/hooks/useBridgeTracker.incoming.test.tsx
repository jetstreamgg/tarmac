/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useBridgeTracker } from './useBridgeTracker';

const mocks = vi.hoisted(() => ({
  address: undefined as string | undefined,
  checkProgress: vi.fn(),
  readSafeTxProgress: vi.fn()
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => 1,
  useChains: () => [{ id: 1 }],
  useConfig: () => ({})
}));
vi.mock('../adapters/registry', () => ({
  getBridgeAdapter: () => ({ checkProgress: mocks.checkProgress })
}));
vi.mock('../adapters/safe', () => ({ readSafeTxProgress: mocks.readSafeTxProgress }));

const NOW = 1_800_000_000_000;

let accountSeq = 0;
const nextAccount = () => `0x${(1000 + ++accountSeq).toString(16).padStart(40, '0')}`;
const scopeOf = (account: string) => pendingScopeKey({ account, familyChainId: 1 });

// A CCTP burn another account of this browser sent to the connected wallet.
const seedIncoming = (sender: string, recipient: string, overrides: Partial<PendingBridge> = {}) => {
  const bridge: PendingBridge = {
    id: `0xburn${++accountSeq}`,
    account: sender,
    recipient,
    amount: 1n,
    token: 'USDS',
    from: 'base',
    to: 'ethereum',
    status: 'pending',
    routeKind: 'cctp',
    requiresClaim: true,
    startedAt: NOW,
    etaAt: NOW + 20 * 60_000,
    txHash: `0xburn${accountSeq}`,
    actions: [],
    ...overrides
  };
  pendingBridgeStore.upsert(scopeOf(sender), bridge);
  return bridge;
};

const renderTracker = (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useBridgeTracker(), { wrapper });
};

const storedIn = (scope: string, id: string) =>
  pendingBridgeStore.getSnapshot(scope).find(bridge => bridge.id === id);

describe("useBridgeTracker: a bridge sent to this wallet from another account's list", () => {
  let sender: string;

  beforeEach(() => {
    mocks.address = nextAccount();
    sender = nextAccount();
    mocks.checkProgress.mockReset();
    mocks.readSafeTxProgress.mockReset();
  });

  it("polls it for the recipient and writes the progress into the sender's list", async () => {
    mocks.checkProgress.mockResolvedValue({ kind: 'ready', nextAction: 'claim' });
    const bridge = seedIncoming(sender, mocks.address!);
    renderTracker();
    await waitFor(() =>
      expect(storedIn(scopeOf(sender), bridge.id)).toMatchObject({ status: 'ready', nextAction: 'claim' })
    );
    expect(storedIn(scopeOf(mocks.address!), bridge.id)).toBeUndefined();
    expect(mocks.checkProgress).toHaveBeenCalledWith(
      expect.objectContaining({ id: bridge.id, account: sender }),
      expect.anything(),
      expect.anything()
    );
  });

  it("polls only the wallet's own entry of a burn it also has in its list", async () => {
    mocks.checkProgress.mockResolvedValue({ kind: 'ready', nextAction: 'claim' });
    const bridge = seedIncoming(sender, mocks.address!);
    pendingBridgeStore.upsert(scopeOf(mocks.address!), { ...bridge });
    renderTracker();
    await waitFor(() =>
      expect(storedIn(scopeOf(mocks.address!), bridge.id)).toMatchObject({ status: 'ready' })
    );
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(storedIn(scopeOf(sender), bridge.id)).toMatchObject({ status: 'pending' });
  });

  it("doesn't poll one sent to someone else, or a settled one", async () => {
    seedIncoming(sender, nextAccount());
    seedIncoming(sender, mocks.address!, { status: 'claimed', settledAt: NOW });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderTracker(client);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(mocks.checkProgress).not.toHaveBeenCalled();
    expect(client.getQueryCache().findAll({ queryKey: ['bridge-progress'] })).toEqual([]);
  });
});
