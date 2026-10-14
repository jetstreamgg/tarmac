/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../morpho/useMorphoVaultMarketApiData', () => ({
  useMorphoVaultMarketApiData: vi.fn()
}));

import { useVaultMarketData } from './useVaultMarketData';
import { useMorphoVaultMarketApiData } from '../morpho/useMorphoVaultMarketApiData';

const VAULT = '0x0000000000000000000000000000000000000001' as const;

const morphoResult = {
  isLoading: false,
  error: null,
  mutate: vi.fn(),
  data: { totalAssets: 123n }
} as unknown as ReturnType<typeof useMorphoVaultMarketApiData>;

describe('useVaultMarketData dispatcher', () => {
  beforeEach(() => {
    vi.mocked(useMorphoVaultMarketApiData).mockReturnValue(morphoResult);
  });

  it('routes a vault to the Morpho data source and returns its normalized result', () => {
    const { result } = renderHook(() => useVaultMarketData({ vaultAddress: VAULT }));

    expect(useMorphoVaultMarketApiData).toHaveBeenCalledWith({ vaultAddress: VAULT });
    expect(result.current).toBe(morphoResult);
  });

  it('preserves the normalized output shape (rate/TVL fields pass through untouched)', () => {
    const { result } = renderHook(() => useVaultMarketData({ vaultAddress: VAULT }));

    expect(result.current.data?.totalAssets).toBe(123n);
  });
});
