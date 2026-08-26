import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Call } from 'viem';

const h = {
  callCounts: [] as number[]
};

vi.mock('@/hooks', () => ({
  useNetworkFee: () => ({ data: undefined, isLoading: true, error: null })
}));

vi.mock('@/modules/ui/components/NetworkFeeValue', () => ({
  useBundleFeeState: (callCount: number) => {
    h.callCounts.push(callCount);
    return { ready: false, settled: false, failed: false, canBundle: callCount > 1 };
  }
}));

import { useModalFeeCell } from './useModalFeeCell';

const CALLS: Call[] = [{ to: '0x1111111111111111111111111111111111111111', data: '0xaa' }];

describe('useModalFeeCell', () => {
  it('counts the calls it prices when the flow does not reshape', () => {
    h.callCounts = [];
    renderHook(() => useModalFeeCell({ calls: CALLS, chainId: 1 }));

    expect(h.callCounts.at(-1)).toBe(1);
  });

  it('takes the flow leg count over the current route length when given one', () => {
    // Stake's engine collapses its legs into a single `multicall` with bundling
    // off, so `calls.length` describes the route rather than the flow. Read as
    // the flow's shape it says "nothing to bundle", and the fee cell drops its
    // own bundle toggle for exactly the people who have bundling switched off.
    h.callCounts = [];
    const { result } = renderHook(() => useModalFeeCell({ calls: CALLS, chainId: 1, legCount: 3 }));

    expect(h.callCounts.at(-1)).toBe(3);
    expect(result.current.state.canBundle).toBe(true);
  });
});
