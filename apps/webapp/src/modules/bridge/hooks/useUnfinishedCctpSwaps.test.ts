/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { useUnfinishedCctpSwaps } from './useUnfinishedCctpSwaps';

const SCOPE = 'test-scope';
const SWAP: UnfinishedCctpSwap = {
  swapTxHash: '0x5a',
  network: 'base',
  usdcAmount: 250n,
  recipient: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
  at: 1
};

const mocks = vi.hoisted(() => ({ scope: undefined as string | undefined }));
vi.mock('./usePendingScope', () => ({ usePendingScope: () => ({ scope: mocks.scope }) }));

describe('useUnfinishedCctpSwaps', () => {
  beforeEach(() => {
    localStorage.clear();
    cctpSwapStore.clear(SCOPE, SWAP.swapTxHash);
    mocks.scope = SCOPE;
  });

  it("follows the connected account's unfinished swaps", () => {
    const { result } = renderHook(() => useUnfinishedCctpSwaps());
    expect(result.current).toEqual([]);
    act(() => cctpSwapStore.record(SCOPE, SWAP));
    expect(result.current).toEqual([SWAP]);
    act(() => cctpSwapStore.clear(SCOPE, SWAP.swapTxHash));
    expect(result.current).toEqual([]);
  });

  it('has none while disconnected', () => {
    cctpSwapStore.record(SCOPE, SWAP);
    mocks.scope = undefined;
    expect(renderHook(() => useUnfinishedCctpSwaps()).result.current).toEqual([]);
  });
});
