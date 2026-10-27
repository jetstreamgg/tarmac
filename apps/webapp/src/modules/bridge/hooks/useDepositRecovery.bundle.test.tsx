/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridge } from '../model/pendingTransitions';
import { nativeDepositRoute } from '../model/resolveRoute';
import { pendingBridgeStore } from '../store/pendingStore';
import type { recoverDeposits } from '../tracking/recoverDeposits';
import { useDepositRecovery } from './useDepositRecovery';

type RecoverArgs = Parameters<typeof recoverDeposits>[0];

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const TO_BLOCK_TIME = 1_700_000_000;

const mocks = vi.hoisted(() => ({
  // The store keeps a scope's cards in memory, so each test reads its own.
  scope: 'scope-0',
  discover: vi.fn(async () => ({ deposits: [], complete: true })),
  recover: vi.fn(async (_: unknown) => 0),
  getCallsStatus: vi.fn(),
  getBlock: vi.fn(async ({ blockNumber }: { blockNumber: bigint }) => ({
    timestamp: blockNumber === 100n ? BigInt(1_700_000_000) : 0n
  })),
  baseGetBlock: vi.fn(async () => ({ timestamp: 1_699_999_000n }))
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('@wagmi/core', () => {
  const publicClient = (chainId: number) => ({
    getBlockNumber: async () => 100n,
    getBlock: chainId === 8453 ? mocks.baseGetBlock : mocks.getBlock
  });
  // wagmi caches getClient per chain, so the adapter context's reader cache behaves as in the app.
  const clients = new Map<number, { extend: () => ReturnType<typeof publicClient> }>();
  return {
    getPublicClient: (_: unknown, { chainId }: { chainId: number }) => publicClient(chainId),
    getClient: (_: unknown, { chainId }: { chainId: number }) => {
      if (!clients.has(chainId)) clients.set(chainId, { extend: () => publicClient(chainId) });
      return clients.get(chainId);
    },
    getCallsStatus: mocks.getCallsStatus
  };
});
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, scope: mocks.scope, familyChainId: 1 })
}));
vi.mock('../adapters/nativeDeposit/discovery', () => ({ discoverNativeDeposits: mocks.discover }));
vi.mock('../tracking/recoverDeposits', () => ({ recoverDeposits: mocks.recover }));

const MINUTE = 60_000;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);

const lastArgs = () => mocks.recover.mock.calls.at(-1)?.[0] as RecoverArgs;

let scopes = 0;

const bundleCard = () =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'ethereum',
    to: 'base',
    route: nativeDepositRoute('base'),
    bundleId: 'bundle-1',
    callsId: '0xcalls',
    now: Date.now()
  });

describe('useDepositRecovery, wallet bundles', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    mocks.scope = `scope-${++scopes}`;
    mocks.discover.mockClear();
    mocks.recover.mockClear();
    mocks.getCallsStatus.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('tells recovery the chain time of the last block it scanned', async () => {
    renderHook(() => useDepositRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(lastArgs().chainNow).toBe(TO_BLOCK_TIME * 1000);
  });

  // A CCTP bundle's burn mined on its L2, whose block numbers Ethereum doesn't share.
  it('reads a block on the network recovery names, and on Ethereum when it names none', async () => {
    renderHook(() => useDepositRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(await lastArgs().blockTime(42n, 'base')).toBe(1_699_999_000 * 1000);
    expect(mocks.baseGetBlock).toHaveBeenCalledWith({ blockNumber: 42n });
    expect(await lastArgs().blockTime(100n)).toBe(TO_BLOCK_TIME * 1000);
  });

  // An L2 block time moves to the device clock by that L2's own clock.
  it("reads an L2's time at its latest block, and none when it can't", async () => {
    renderHook(() => useDepositRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(await lastArgs().chainNowOn?.('base')).toBe(1_699_999_000 * 1000);
    expect(mocks.baseGetBlock).toHaveBeenLastCalledWith();
    mocks.baseGetBlock.mockRejectedValueOnce(new Error('rpc down'));
    expect(await lastArgs().chainNowOn?.('base')).toBeUndefined();
  });

  it('passes the wallet status of a bundle through, and an error as no answer', async () => {
    renderHook(() => useDepositRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    const { callsStatus } = lastArgs();
    mocks.getCallsStatus.mockResolvedValueOnce({ status: 'success', receipts: [] });
    expect(await callsStatus?.('0xcalls')).toMatchObject({ status: 'success' });
    expect(mocks.getCallsStatus).toHaveBeenLastCalledWith({}, { id: '0xcalls' });
    mocks.getCallsStatus.mockRejectedValueOnce(new Error('Unsupported method'));
    expect(await callsStatus?.('0xcalls')).toBeUndefined();
  });

  it('scans again within minutes while a bundle card has no hash', async () => {
    pendingBridgeStore.upsert(mocks.scope, bundleCard());
    renderHook(() => useDepositRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.discover).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3 * MINUTE);
    expect(mocks.discover.mock.calls.length).toBeGreaterThan(1);
  });

  it('waits the full interval once no bundle card is waiting for its hash', async () => {
    renderHook(() => useDepositRecovery(), { wrapper });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(29 * MINUTE);
    expect(mocks.discover).toHaveBeenCalledTimes(1);
  });
});
