import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePortfolioSupplyActions } from './usePortfolioSupplyActions';
import type { SuppliedPosition } from '../helpers/suppliedView';

const h = vi.hoisted(() => ({ openSupply: vi.fn(), chainId: 1 }));

vi.mock('wagmi', () => ({ useChainId: () => h.chainId }));

vi.mock('@/modules/savings/hooks/useSavingsModal', () => ({
  useSavingsModal: () => ({ openSupply: h.openSupply, openWithdraw: vi.fn() })
}));

const position = (kind: SuppliedPosition['kind'], chainIds: number[] = [1]): SuppliedPosition => ({
  id: kind,
  name: kind,
  tokenSymbol: 'USDS',
  kind,
  amountUsd: 100,
  rate: 0.05,
  color: '#000',
  share: 1,
  detailPath: `/earn/${kind}`,
  chainIds
});

describe('usePortfolioSupplyActions', () => {
  beforeEach(() => {
    h.openSupply.mockClear();
    h.chainId = 1;
  });
  afterEach(() => cleanup());

  it('resolves a savings position on the connected chain to an opener that launches the supply modal', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());
    const handler = result.current(position('savings', [1]));

    expect(handler).toBeTypeOf('function');
    handler!();
    expect(h.openSupply).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for a savings position not on the connected chain (caller navigates)', () => {
    h.chainId = 1; // wallet on mainnet
    const { result } = renderHook(() => usePortfolioSupplyActions());

    // Card scoped to Base — the in-place modal would supply on mainnet, so don't open it.
    expect(result.current(position('savings', [8453]))).toBeUndefined();
    expect(h.openSupply).not.toHaveBeenCalled();
  });

  it('returns undefined for products with no in-place supply modal (caller navigates)', () => {
    const { result } = renderHook(() => usePortfolioSupplyActions());

    for (const kind of ['rewards', 'vault', 'fixed', 'stusds'] as const) {
      expect(result.current(position(kind))).toBeUndefined();
    }
    expect(h.openSupply).not.toHaveBeenCalled();
  });
});
