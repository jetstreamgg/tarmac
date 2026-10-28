/**
 * @vitest-environment happy-dom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import type { CctpBurnLookup } from '../adapters/cctp/lookup';
import type { IncomingBridge } from './useIncomingCctpBridges';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useBridgeClaimLookup, type BridgeClaimTarget } from './useBridgeClaimLookup';

const mocks = vi.hoisted(() => ({
  address: undefined as string | undefined,
  lookup: vi.fn(),
  getClient: vi.fn(),
  incoming: [] as IncomingBridge[]
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => 1,
  useChains: () => [{ id: 1 }],
  useConfig: () => ({})
}));
vi.mock('./adapterContext', () => ({
  wagmiAdapterContext: () => ({ getClient: mocks.getClient })
}));
vi.mock('../adapters/cctp/lookup', () => ({ lookupCctpBurn: mocks.lookup }));
vi.mock('./useIncomingCctpBridges', () => ({ useIncomingCctpBridges: () => mocks.incoming }));

const HASH = `0x${'ab'.repeat(32)}` as Hex;
const TARGET: BridgeClaimTarget = { from: 'base', txHash: HASH };
const CLIENT = { name: 'base reader' };

let accountSeq = 0;
const nextAccount = () => `0x${(2000 + ++accountSeq).toString(16).padStart(40, '0')}`;
const scopeOf = (account: string) => pendingScopeKey({ account, familyChainId: 1 });

const burn = (overrides: Partial<PendingBridge> = {}): PendingBridge => ({
  id: HASH,
  account: mocks.address!.toLowerCase(),
  amount: 5n * 10n ** 18n,
  token: 'USDS',
  from: 'base',
  to: 'ethereum',
  status: 'pending',
  routeKind: 'cctp',
  requiresClaim: true,
  nextAction: 'claim',
  startedAt: 1,
  etaAt: 2,
  txHash: HASH,
  actions: [],
  ...overrides
});

// null renders with no target.
const renderLookup = (target: BridgeClaimTarget | null = TARGET) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ value, attempt }) => useBridgeClaimLookup(value, attempt), {
    wrapper,
    initialProps: { value: target ?? undefined, attempt: 0 }
  });
};

describe('useBridgeClaimLookup', () => {
  beforeEach(() => {
    mocks.address = nextAccount();
    mocks.incoming = [];
    mocks.lookup.mockReset();
    mocks.getClient.mockReset().mockReturnValue(CLIENT);
  });
  afterEach(() => localStorage.clear());

  it('reads nothing while disconnected', () => {
    mocks.address = undefined;
    const { result } = renderLookup();
    expect(result.current).toEqual({ status: 'disconnected' });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('reads nothing without a target', () => {
    const { result } = renderLookup(null);
    expect(result.current).toEqual({ status: 'idle' });
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("looks the burn up on its network's client for the connected wallet", async () => {
    mocks.lookup.mockReturnValue(new Promise(() => {}));
    const { result } = renderLookup();
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(mocks.lookup).toHaveBeenCalled());
    expect(mocks.getClient).toHaveBeenCalledWith('base');
    expect(mocks.lookup).toHaveBeenCalledWith({
      from: 'base',
      txHash: HASH,
      account: mocks.address,
      client: CLIENT
    });
  });

  it('passes a refusal through', async () => {
    const refused: CctpBurnLookup = { status: 'refused', reason: 'not-a-bridge' };
    mocks.lookup.mockResolvedValue(refused);
    const { result } = renderLookup();
    await waitFor(() => expect(result.current).toEqual(refused));
  });

  it('offers a retry when the network read fails, and reads again on it', async () => {
    mocks.lookup.mockRejectedValueOnce(new Error('rpc down'));
    const { result } = renderLookup();
    await waitFor(() => expect(result.current.status).toBe('error'));
    const found: CctpBurnLookup = { status: 'found', bridge: burn() };
    mocks.lookup.mockResolvedValue(found);
    act(() => {
      if (result.current.status === 'error') result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('found'));
  });

  it('says it is looking it up again while a retry reads', async () => {
    mocks.lookup.mockRejectedValueOnce(new Error('rpc down'));
    const { result } = renderLookup();
    await waitFor(() => expect(result.current.status).toBe('error'));
    mocks.lookup.mockReturnValue(new Promise(() => {}));
    act(() => {
      if (result.current.status === 'error') result.current.retry();
    });
    await waitFor(() => expect(mocks.lookup).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('loading');
  });

  it('reads the chain again on another attempt at the same burn', async () => {
    mocks.lookup.mockResolvedValueOnce({ status: 'refused', reason: 'not-found' });
    const { result, rerender } = renderLookup();
    await waitFor(() => expect(result.current.status).toBe('refused'));
    mocks.lookup.mockResolvedValue({ status: 'found', bridge: burn() });
    rerender({ value: { ...TARGET }, attempt: 1 });
    await waitFor(() => expect(result.current.status).toBe('found'));
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
  });

  it('fails as a read error when the app has no client for the network', async () => {
    mocks.getClient.mockReturnValue(undefined);
    const { result } = renderLookup();
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("adds a found burn to the connected wallet's list", async () => {
    const bridge = burn();
    mocks.lookup.mockResolvedValue({ status: 'found', bridge });
    const { result } = renderLookup();
    await waitFor(() => expect(result.current.status).toBe('found'));
    act(() => {
      if (result.current.status === 'found') result.current.add();
    });
    expect(pendingBridgeStore.getSnapshot(scopeOf(mocks.address!))).toEqual([bridge]);
  });

  it('says a burn already in the list is there, by its hash in any case', async () => {
    const stored = burn({
      id: HASH.toUpperCase().replace('0X', '0x'),
      txHash: HASH.toUpperCase().replace('0X', '0x')
    });
    pendingBridgeStore.upsert(scopeOf(mocks.address!), stored);
    mocks.lookup.mockResolvedValue({ status: 'found', bridge: burn() });
    const { result } = renderLookup();
    await waitFor(() => expect(result.current).toEqual({ status: 'known' }));
  });

  it('reads nothing for a burn already in the list', async () => {
    pendingBridgeStore.upsert(scopeOf(mocks.address!), burn());
    const { result } = renderLookup();
    expect(result.current).toEqual({ status: 'known' });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it('says a burn another account of this browser sent here is already listed', async () => {
    mocks.incoming = [{ scope: scopeOf(nextAccount()), bridge: burn({ recipient: mocks.address }) }];
    mocks.lookup.mockResolvedValue({ status: 'found', bridge: burn() });
    const { result } = renderLookup();
    await waitFor(() => expect(result.current).toEqual({ status: 'known' }));
  });

  it('says a burn in the list, or sent here, was already claimed once it was', () => {
    pendingBridgeStore.upsert(
      scopeOf(mocks.address!),
      burn({ status: 'claimed', nextAction: 'convert', settledAt: 3 })
    );
    expect(renderLookup().result.current).toEqual({ status: 'known', claimed: true });
    localStorage.clear();
    mocks.address = nextAccount();
    mocks.incoming = [
      {
        scope: scopeOf(nextAccount()),
        bridge: burn({ recipient: mocks.address, status: 'arrived', settledAt: 3 })
      }
    ];
    expect(renderLookup().result.current).toEqual({ status: 'known', claimed: true });
  });

  it('reads again for another wallet', async () => {
    mocks.lookup.mockResolvedValue({ status: 'refused', reason: 'not-found' });
    const { result, rerender } = renderLookup();
    await waitFor(() => expect(result.current.status).toBe('refused'));
    const first = mocks.address;
    mocks.address = nextAccount();
    rerender({ value: TARGET as BridgeClaimTarget | undefined, attempt: 0 });
    await waitFor(() => expect(mocks.lookup).toHaveBeenCalledTimes(2));
    expect(mocks.lookup.mock.calls.map(([args]) => args.account)).toEqual([first, mocks.address]);
  });
});
