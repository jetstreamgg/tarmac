/**
 * @vitest-environment happy-dom
 */
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridge } from '../model/pendingTransitions';
import { cctpWithdrawalRoute, nativeDepositRoute } from '../model/resolveRoute';
import { pendingBridgeStore } from '../store/pendingStore';
import type { recoverDeposits } from '../tracking/recoverDeposits';
import { useDepositRecovery } from './useDepositRecovery';

// While a wallet bundle has no hash, its deposit is still looked for soon
// after the send, without reading the whole window every 2 minutes.

type RecoverArgs = Parameters<typeof recoverDeposits>[0];

const ACCOUNT = '0x71c7656ec7ab88b098defb751b7401b5f6d8976f';
const MINUTE = 60_000;
const START = 1_800_000_000_000;
// The chain's clock runs behind the device's.
const CHAIN_BEHIND = 3 * MINUTE;

const mocks = vi.hoisted(() => ({
  scope: 'cadence-0',
  discover: vi.fn(async (_: { recentOnly?: boolean }) => ({ deposits: [], complete: true })),
  recover: vi.fn(async (_: unknown) => 0),
  getCallsStatus: vi.fn(async () => undefined),
  getBlockNumber: vi.fn(async () => 100n),
  getBlock: vi.fn()
}));

vi.mock('wagmi', () => ({ useConfig: () => ({}) }));
vi.mock('wagmi/actions', () => {
  const publicClient = () => ({ getBlockNumber: mocks.getBlockNumber, getBlock: mocks.getBlock });
  return {
    getPublicClient: publicClient,
    getClient: () => ({ extend: publicClient }),
    getCallsStatus: mocks.getCallsStatus
  };
});
vi.mock('./usePendingScope', () => ({
  usePendingScope: () => ({ account: ACCOUNT, scope: mocks.scope, familyChainId: 1 })
}));
vi.mock('../adapters/nativeDeposit/discovery', () => ({ discoverNativeDeposits: mocks.discover }));
vi.mock('../tracking/recoverDeposits', () => ({ recoverDeposits: mocks.recover }));

let scopes = 0;
let queryClient: QueryClient;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);

const depositBundle = (id = 'bundle-1') =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'ethereum',
    to: 'base',
    route: nativeDepositRoute('base'),
    bundleId: id,
    callsId: '0xcalls',
    now: Date.now()
  });
const burnBundle = () =>
  createPendingBridge({
    account: ACCOUNT,
    amount: 5n * 10n ** 18n,
    from: 'base',
    to: 'ethereum',
    route: cctpWithdrawalRoute('base'),
    bundleId: 'bundle-burn',
    callsId: '0xcalls',
    now: Date.now()
  });

/** Each read of Ethereum's logs so far: the whole window, or its newest range alone. */
const reads = () => mocks.discover.mock.calls.map(([args]) => (args.recentOnly ? 'recent' : 'whole'));
const mount = async () => {
  renderHook(() => useDepositRecovery(), { wrapper });
  await vi.advanceTimersByTimeAsync(0);
};
const minutes = (count: number) => vi.advanceTimersByTimeAsync(count * MINUTE);
const lastArgs = () => mocks.recover.mock.calls.at(-1)?.[0] as RecoverArgs;

describe('useDepositRecovery, the pace of its chain reads', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: START });
    localStorage.clear();
    mocks.scope = `cadence-${++scopes}`;
    queryClient = new QueryClient();
    mocks.discover.mockReset();
    mocks.discover.mockResolvedValue({ deposits: [], complete: true });
    mocks.recover.mockClear();
    mocks.getBlockNumber.mockClear();
    mocks.getBlock.mockReset();
    mocks.getBlock.mockImplementation(async () => ({
      timestamp: BigInt(Math.floor((Date.now() - CHAIN_BEHIND) / 1000))
    }));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("looks for a deposit bundle's deposit 2, 6 and 14 minutes after the send, in the newest range", async () => {
    pendingBridgeStore.upsert(mocks.scope, depositBundle());
    await mount();
    expect(reads()).toEqual(['whole']);
    await minutes(1);
    expect(reads()).toEqual(['whole']);
    await minutes(1);
    expect(reads()).toEqual(['whole', 'recent']);
    await minutes(3);
    expect(reads()).toEqual(['whole', 'recent']);
    await minutes(1);
    expect(reads()).toEqual(['whole', 'recent', 'recent']);
    await minutes(7);
    expect(reads()).toEqual(['whole', 'recent', 'recent']);
    await minutes(1);
    expect(reads()).toEqual(['whole', 'recent', 'recent', 'recent']);
  });

  it('still reads the whole window every 30 minutes while the bundle waits', async () => {
    pendingBridgeStore.upsert(mocks.scope, depositBundle());
    await mount();
    await minutes(29);
    expect(reads().filter(read => read === 'whole')).toHaveLength(1);
    await minutes(1);
    expect(reads().at(-1)).toBe('whole');
    await minutes(30);
    expect(reads().filter(read => read === 'whole')).toHaveLength(3);
    expect(reads()).toHaveLength(6);
  });

  it('asks the wallet every 2 minutes in between, without reading the chain', async () => {
    pendingBridgeStore.upsert(mocks.scope, depositBundle());
    await mount();
    await minutes(4);
    expect(mocks.recover).toHaveBeenCalledTimes(3);
    expect(mocks.getBlockNumber).toHaveBeenCalledTimes(2);
    expect(lastArgs().deposits).toEqual([]);
    expect(lastArgs().callsStatus).toBeDefined();
    // The chain's time moves on from the last read, by the device clock.
    expect(lastArgs().chainNow).toBe(Date.now() - CHAIN_BEHIND);
  });

  it('looks at once when the launch asks, in the newest range', async () => {
    pendingBridgeStore.upsert(mocks.scope, depositBundle());
    await mount();
    await minutes(1);
    await act(() => queryClient.invalidateQueries({ queryKey: ['bridge-deposit-recovery', mocks.scope] }));
    await vi.advanceTimersByTimeAsync(0);
    expect(reads()).toEqual(['whole', 'recent']);
  });

  it('looks again 2 minutes later when the newest range could not be read', async () => {
    pendingBridgeStore.upsert(mocks.scope, depositBundle());
    await mount();
    mocks.discover.mockResolvedValueOnce({ deposits: [], complete: false });
    await minutes(2);
    expect(reads()).toEqual(['whole', 'recent']);
    await minutes(2);
    expect(reads()).toEqual(['whole', 'recent', 'recent']);
    await minutes(1);
    expect(reads()).toEqual(['whole', 'recent', 'recent']);
  });

  it("reads no Ethereum logs for an L2 bundle's burn, only the wallet", async () => {
    pendingBridgeStore.upsert(mocks.scope, burnBundle());
    await mount();
    await minutes(28);
    expect(reads()).toEqual(['whole']);
    expect(mocks.recover).toHaveBeenCalledTimes(15);
  });

  it('looks for a bundle sent after the last read 2 minutes after its send', async () => {
    await mount();
    await minutes(10);
    act(() => pendingBridgeStore.upsert(mocks.scope, depositBundle()));
    await minutes(1);
    expect(reads()).toEqual(['whole']);
    await vi.advanceTimersByTimeAsync(MINUTE + 1);
    expect(reads()).toEqual(['whole', 'recent']);
  });

  it('reads the whole window 30 minutes after the last whole read once the bundle has its hash', async () => {
    const bundle = depositBundle();
    pendingBridgeStore.upsert(mocks.scope, bundle);
    await mount();
    await minutes(21);
    act(() => void pendingBridgeStore.resolveBundle(mocks.scope, bundle.id, `0x${'ab'.repeat(32)}`));
    const before = reads().length;
    await minutes(8);
    expect(reads()).toHaveLength(before);
    await minutes(1);
    expect(reads()).toHaveLength(before + 1);
    expect(reads().at(-1)).toBe('whole');
  });
});
