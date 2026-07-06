/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock both provider hooks the dispatcher delegates to.
vi.mock('../morpho/useMorphoVaultMarketApiData', () => ({
  useMorphoVaultMarketApiData: vi.fn()
}));
vi.mock('./spark/useSparkVaultApiData', () => ({
  useSparkVaultApiData: vi.fn()
}));

import { useVaultMarketData } from './useVaultMarketData';
import { useMorphoVaultMarketApiData } from '../morpho/useMorphoVaultMarketApiData';
import { useSparkVaultApiData } from './spark/useSparkVaultApiData';

const VAULT = '0x0000000000000000000000000000000000000001' as const;

const morphoResult = {
  isLoading: false,
  error: null,
  mutate: vi.fn(),
  data: { totalAssets: 123n }
} as unknown as ReturnType<typeof useMorphoVaultMarketApiData>;

const sparkResult = {
  isLoading: false,
  error: null,
  mutate: vi.fn(),
  data: { totalAssets: 456n }
} as unknown as ReturnType<typeof useSparkVaultApiData>;

describe('useVaultMarketData dispatcher', () => {
  beforeEach(() => {
    vi.mocked(useMorphoVaultMarketApiData).mockReturnValue(morphoResult);
    vi.mocked(useSparkVaultApiData).mockReturnValue(sparkResult);
  });

  it("routes a 'morpho' vault to the Morpho data source and returns its normalized result", () => {
    const { result } = renderHook(() => useVaultMarketData({ provider: 'morpho', vaultAddress: VAULT }));

    expect(useMorphoVaultMarketApiData).toHaveBeenCalledWith({ vaultAddress: VAULT });
    expect(result.current).toBe(morphoResult);
  });

  it('preserves the normalized output shape (rate/TVL fields pass through untouched)', () => {
    const { result } = renderHook(() => useVaultMarketData({ provider: 'morpho', vaultAddress: VAULT }));

    expect(result.current.data?.totalAssets).toBe(123n);
  });

  it("routes a 'sky' vault to the Spark data source and returns its normalized result", () => {
    const { result } = renderHook(() => useVaultMarketData({ provider: 'sky', vaultAddress: VAULT }));

    expect(useSparkVaultApiData).toHaveBeenCalledWith({ vaultAddress: VAULT });
    expect(result.current).toBe(sparkResult);
    expect(result.current.data?.totalAssets).toBe(456n);
  });

  it('keeps the inactive provider hook disabled by passing an undefined address', () => {
    renderHook(() => useVaultMarketData({ provider: 'sky', vaultAddress: VAULT }));
    // Spark active -> Morpho gets undefined (query disabled, no wrong-provider fetch).
    expect(useMorphoVaultMarketApiData).toHaveBeenCalledWith({ vaultAddress: undefined });

    vi.clearAllMocks();
    vi.mocked(useMorphoVaultMarketApiData).mockReturnValue(morphoResult);
    vi.mocked(useSparkVaultApiData).mockReturnValue(sparkResult);

    renderHook(() => useVaultMarketData({ provider: 'morpho', vaultAddress: VAULT }));
    // Morpho active -> Spark gets undefined.
    expect(useSparkVaultApiData).toHaveBeenCalledWith({ vaultAddress: undefined });
  });
});
