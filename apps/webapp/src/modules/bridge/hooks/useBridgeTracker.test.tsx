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
  readSafeTxProgress: vi.fn(),
  notifyBridgeArrived: vi.fn()
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
vi.mock('../components/BridgeArrivedToast', () => ({ notifyBridgeArrived: mocks.notifyBridgeArrived }));

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

const renderTracker = (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
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
    mocks.notifyBridgeArrived.mockReset();
  });

  it('writes what the route adapter reports into the store', async () => {
    mocks.checkProgress.mockResolvedValue({ kind: 'ready', nextAction: 'claim' });
    seed({ txHash: '0xsource' });
    renderTracker();
    await waitFor(() => expect(stored('0xsource')).toMatchObject({ status: 'ready', nextAction: 'claim' }));
  });

  it('marks the balances read on the destination chain stale once a bridge arrived', async () => {
    mocks.checkProgress.mockResolvedValue({ kind: 'arrived' });
    seed({ txHash: '0xsource' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const balanceOn = (chainId: number) => [
      'readContracts',
      { contracts: [{ chainId, functionName: 'balanceOf' }] }
    ];
    // The app's multi-token balances, keyed by a chain-to-tokens map.
    const tokensOn = (...chainIds: number[]) => [
      'token-balances',
      mocks.address,
      Object.fromEntries(chainIds.map(chainId => [chainId, [{ symbol: 'USDS' }]]))
    ];
    for (const key of [balanceOn(1), balanceOn(8453), tokensOn(1), tokensOn(1, 8453), tokensOn(8453)])
      client.setQueryData(key, [1n, 18]);
    renderTracker(client);
    await waitFor(() => expect(client.getQueryState(balanceOn(1))?.isInvalidated).toBe(true));
    expect(client.getQueryState(tokensOn(1))?.isInvalidated).toBe(true);
    expect(client.getQueryState(tokensOn(1, 8453))?.isInvalidated).toBe(true);
    expect(client.getQueryState(balanceOn(8453))?.isInvalidated).toBe(false);
    expect(client.getQueryState(tokensOn(8453))?.isInvalidated).toBe(false);
  });

  it('asks the Safe service on the source chain for a queued Safe bridge', async () => {
    mocks.readSafeTxProgress.mockResolvedValue({ kind: 'source-executed', txHash: '0xexec' });
    seed({ safeTxHash: '0xsafe' });
    renderTracker();
    await waitFor(() => expect(stored('0xsafe')).toMatchObject({ txHash: '0xexec' }));
    expect(mocks.readSafeTxProgress).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 8453, safeTxHash: '0xsafe' })
    );
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

  describe('the arrived toast', () => {
    it('tells the viewer once when a bridge in their list lands, as listed in Activity', async () => {
      mocks.checkProgress.mockResolvedValue({ kind: 'arrived' });
      seed({ txHash: '0xland' });
      renderTracker();
      await waitFor(() => expect(mocks.notifyBridgeArrived).toHaveBeenCalledTimes(1));
      expect(mocks.notifyBridgeArrived.mock.calls[0]?.[0]).toMatchObject({
        bridge: { id: '0xland', settledAt: expect.any(Number) },
        account: mocks.address,
        inActivity: true,
        familyChainId: 1
      });
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(mocks.notifyBridgeArrived).toHaveBeenCalledTimes(1);
    });

    it("tells the recipient of a bridge in the sender's list, as not in their Activity", async () => {
      mocks.checkProgress.mockResolvedValue({ kind: 'arrived' });
      const recipient = mocks.address!;
      mocks.address = nextAccount();
      const resolved = resolveBridgeRoute({
        from: 'base',
        to: 'ethereum',
        amount: 1n,
        facts: { cctp: { isOpen: true } }
      });
      if (resolved.status !== 'ok') throw new Error(resolved.reason);
      pendingBridgeStore.upsert(
        scope(),
        createPendingBridge({
          account: mocks.address,
          amount: 1n,
          from: 'base',
          to: 'ethereum',
          recipient,
          route: resolved.route,
          txHash: '0xincoming',
          now: NOW
        })
      );
      mocks.address = recipient;
      renderTracker();
      await waitFor(() => expect(mocks.notifyBridgeArrived).toHaveBeenCalledTimes(1));
      expect(mocks.notifyBridgeArrived.mock.calls[0]?.[0]).toMatchObject({
        bridge: { id: '0xincoming' },
        account: recipient,
        inActivity: false
      });
    });

    it('stays quiet on a claim the user sent, whose own flow told them', async () => {
      mocks.checkProgress.mockResolvedValue({ kind: 'arrived' });
      const bridge = seed({ txHash: '0xclaimed' });
      pendingBridgeStore.update(scope(), bridge.id, entry => ({
        ...entry,
        status: 'ready',
        nextAction: 'finalize',
        actions: [{ action: 'finalize', txHash: '0xf', at: NOW, status: 'sent' }]
      }));
      renderTracker();
      await waitFor(() => expect(stored(bridge.id)?.settledAt).toEqual(expect.any(Number)));
      expect(mocks.notifyBridgeArrived).not.toHaveBeenCalled();
    });

    it.each([
      [{ kind: 'waiting' }],
      [{ kind: 'ready', nextAction: 'claim' }],
      [{ kind: 'failed', reason: 'x' }],
      [{ kind: 'expired' }]
    ])('stays quiet on $kind', async progress => {
      mocks.checkProgress.mockResolvedValue(progress);
      seed({ txHash: '0xother' });
      renderTracker();
      await waitFor(() => expect(mocks.checkProgress).toHaveBeenCalled());
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(mocks.notifyBridgeArrived).not.toHaveBeenCalled();
    });
  });
});
