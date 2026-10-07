/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPendingBridge, applyProgress } from '../model/pendingTransitions';
import { resolveBridgeRoute } from '../model/resolveRoute';
import { pendingBridgeStore, pendingScopeKey } from '../store/pendingStore';
import { useBridgeHistory } from './useBridgeHistory';
import { usePendingBridges } from './usePendingBridges';

const mocks = vi.hoisted(() => ({ address: undefined as string | undefined, chainId: 1 }));

vi.mock('wagmi', () => ({
  useConnection: () => ({ address: mocks.address }),
  useChainId: () => mocks.chainId,
  useChains: () => [{ id: 1 }, { id: 8453 }, { id: 314310 }]
}));

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60_000;

// The store is a module singleton with a per-scope cache, so each test gets its own account.
let accountSeq = 0;
const nextAccount = () => `0x${(++accountSeq).toString(16).padStart(40, '0')}`;

const seed = (account: string, id: string, startedAt = NOW) => {
  const resolved = resolveBridgeRoute({ from: 'ethereum', to: 'base', amount: 1n, facts: {} });
  if (resolved.status !== 'ok') throw new Error(resolved.reason);
  const bridge = createPendingBridge({
    account,
    amount: 1n,
    from: 'ethereum',
    to: 'base',
    route: resolved.route,
    txHash: id,
    now: startedAt
  });
  pendingBridgeStore.upsert(pendingScopeKey({ account, familyChainId: 1 }), bridge);
  return bridge;
};

describe('useBridgeHistory', () => {
  beforeEach(() => {
    mocks.address = nextAccount();
    mocks.chainId = 1;
  });

  it('is empty while disconnected', () => {
    seed(mocks.address!, '0xa');
    mocks.address = undefined;
    expect(renderHook(() => useBridgeHistory()).result.current).toEqual([]);
  });

  it('re-renders when the store changes', () => {
    const { result } = renderHook(() => useBridgeHistory());
    expect(result.current).toEqual([]);
    act(() => void seed(mocks.address!, '0xa'));
    expect(result.current.map(bridge => bridge.id)).toEqual(['0xa']);
  });

  it('shares one list across a chain family: Base sees bridges stored on Ethereum', () => {
    seed(mocks.address!, '0xa');
    mocks.chainId = 8453;
    expect(renderHook(() => useBridgeHistory()).result.current.map(bridge => bridge.id)).toEqual(['0xa']);
    mocks.chainId = 314310;
    expect(renderHook(() => useBridgeHistory()).result.current).toEqual([]);
  });
});

describe('usePendingBridges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.address = nextAccount();
    mocks.chainId = 1;
  });
  afterEach(() => vi.useRealTimers());

  it('hides a settled bridge once its day is over, as the clock ticks', () => {
    const scope = pendingScopeKey({ account: mocks.address!, familyChainId: 1 });
    seed(mocks.address!, '0xactive');
    const settled = seed(mocks.address!, '0xsettled', NOW - 1);
    pendingBridgeStore.update(scope, settled.id, bridge => applyProgress(bridge, { kind: 'arrived' }, NOW));

    const { result } = renderHook(() => usePendingBridges());
    expect(result.current.bridges.map(bridge => bridge.id)).toEqual(['0xactive', '0xsettled']);

    act(() => void vi.setSystemTime(NOW + DAY + 30_000));
    act(() => void vi.advanceTimersByTime(15_000));
    expect(result.current.now).toBeGreaterThan(NOW + DAY);
    expect(result.current.bridges.map(bridge => bridge.id)).toEqual(['0xactive']);
  });

  it('does not re-render every 15 s while nothing is in flight', () => {
    const scope = pendingScopeKey({ account: mocks.address!, familyChainId: 1 });
    const settled = seed(mocks.address!, '0xsettled', NOW - 1);
    pendingBridgeStore.update(scope, settled.id, bridge => applyProgress(bridge, { kind: 'arrived' }, NOW));
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return usePendingBridges();
    });
    const before = renders;
    act(() => void vi.advanceTimersByTime(15_000));
    expect(renders).toBe(before);
  });
});
