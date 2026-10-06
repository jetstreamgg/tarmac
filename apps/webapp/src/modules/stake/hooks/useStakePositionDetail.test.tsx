import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StakeUrnClaimable } from './useStakeUrnClaimables';

const h = vi.hoisted(() => ({
  claimables: [] as { contractAddress: string; claimBalance: bigint; rewardSymbol: string }[],
  vaultLoading: false,
  urnVaults: undefined as
    { index: number; urnAddress: `0x${string}`; skyLocked: bigint; usdsDebt: bigint }[] | undefined
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

// Everything except the claimables shape is inert for the chip math under test.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeUrnAddress: () => ({ data: '0x1111111111111111111111111111111111111111' }),
    useVault: () => ({ data: undefined, isLoading: h.vaultLoading, error: null }),
    useCollateralData: () => ({ data: undefined, isLoading: false, error: null }),
    useStakeUrnSelectedRewardContract: () => ({ data: undefined }),
    useStakeUrnSelectedVoteDelegate: () => ({ data: undefined }),
    useRewardContractTokens: () => ({ data: undefined }),
    useMultipleRewardsChartInfo: () => ({ data: [] }),
    useHighestRateFromChartData: () => null,
    usePrices: () => ({ data: {}, isLoading: false, error: null }),
    useSkyPrice: () => ({ data: undefined, priceString: undefined, isLoading: false }),
    useStakeHistory: () => ({ data: [], isLoading: false, error: null })
  };
});

vi.mock('./useStakeUrnVaults', () => ({
  useStakeUrnVaults: () => ({
    data: h.urnVaults,
    isLoading: false,
    isFetching: false,
    error: null,
    mutate: () => {}
  })
}));

vi.mock('./useStakeUrnClaimables', () => ({
  useStakeUrnClaimables: () => ({
    claimables: h.claimables as StakeUrnClaimable[],
    isLoading: false,
    urnAddress: '0x1111111111111111111111111111111111111111'
  })
}));

import { useStakePositionDetail } from './useStakePositionDetail';

const claimable = (rewardSymbol: string, claimBalance: bigint) => ({
  contractAddress: '0x2222222222222222222222222222222222222222',
  claimBalance,
  rewardSymbol
});

describe('useStakePositionDetail — claim chip amount', () => {
  beforeEach(() => {
    h.claimables = [];
    h.vaultLoading = false;
    h.urnVaults = undefined;
  });

  it("is the first symbol's own balance, never a sum across different tokens", () => {
    h.claimables = [claimable('SKY', 5n * 10n ** 18n), claimable('USDS', 7n * 10n ** 18n)];

    const { result } = renderHook(() => useStakePositionDetail(0));

    expect(result.current.claimableSymbols).toEqual(['SKY', 'USDS']);
    // 5 SKY — not 12 of two incommensurable tokens.
    expect(result.current.claimableTokenAmount).toBe(5n * 10n ** 18n);
  });

  it('skips zero-balance entries when picking the chip token', () => {
    h.claimables = [claimable('SKY', 0n), claimable('USDS', 7n * 10n ** 18n)];

    const { result } = renderHook(() => useStakePositionDetail(0));

    expect(result.current.claimableSymbols).toEqual(['USDS']);
    expect(result.current.claimableTokenAmount).toBe(7n * 10n ** 18n);
  });

  it('reports zero with the SKY fallback symbol when nothing is claimable', () => {
    const { result } = renderHook(() => useStakePositionDetail(0));

    expect(result.current.claimableSymbols).toEqual(['SKY']);
    expect(result.current.claimableTokenAmount).toBe(0n);
  });
});

describe('useStakePositionDetail — menu shape while the vault is cold', () => {
  const urn = (skyLocked: bigint, usdsDebt: bigint) => ({
    index: 0,
    urnAddress: '0x1111111111111111111111111111111111111111' as const,
    skyLocked,
    usdsDebt
  });
  beforeEach(() => {
    h.claimables = [];
    h.vaultLoading = true;
  });

  it('holds the shape when neither the vault nor the table read has landed', () => {
    h.urnVaults = undefined;
    const { result } = renderHook(() => useStakePositionDetail(0));
    expect(result.current.shapeLoading).toBe(true);
  });

  it('commits the active debt shape from the warm table read', () => {
    h.urnVaults = [urn(10n ** 18n, 5n * 10n ** 18n)];
    const { result } = renderHook(() => useStakePositionDetail(0));
    expect(result.current.shapeLoading).toBe(false);
    expect(result.current.hasDebt).toBe(true);
    expect(result.current.isInactive).toBe(false);
  });

  it('commits the inactive shape from the warm table read', () => {
    h.urnVaults = [urn(0n, 0n)];
    const { result } = renderHook(() => useStakePositionDetail(0));
    expect(result.current.shapeLoading).toBe(false);
    expect(result.current.hasDebt).toBe(false);
    expect(result.current.isInactive).toBe(true);
  });
});
