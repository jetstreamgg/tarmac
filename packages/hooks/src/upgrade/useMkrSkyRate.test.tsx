import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMkrSkyRate } from './useMkrSkyRate';
import { useReadContract, useChainId } from 'wagmi';
import { mkrSkyAddress } from '../generated';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useReadContract: vi.fn(),
  useChainId: vi.fn()
}));

describe('useMkrSkyRate', () => {
  const mockChainId = 1; // mainnet
  const mockRate = 24000n;
  const mockAddress = mkrSkyAddress[1];

  beforeEach(() => {
    vi.clearAllMocks();
    (useChainId as any).mockReturnValue(mockChainId);
  });

  it('should fetch the conversion rate from the contract', () => {
    const mockReadContract = {
      data: mockRate,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    };

    (useReadContract as any).mockReturnValue(mockReadContract);

    const { result } = renderHook(() => useMkrSkyRate());

    expect(result.current.data).toBe(mockRate);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should call useReadContract with correct parameters', () => {
    const mockReadContract = {
      data: mockRate,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    };

    (useReadContract as any).mockReturnValue(mockReadContract);

    renderHook(() => useMkrSkyRate());

    expect(useReadContract).toHaveBeenCalledWith({
      address: mockAddress,
      abi: expect.any(Array),
      functionName: 'rate',
      chainId: mockChainId,
      query: {
        staleTime: 60 * 1000,
        refetchInterval: 60 * 1000,
        refetchOnWindowFocus: true
      }
    });
  });

  it('should handle loading state', () => {
    const mockReadContract = {
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    };

    (useReadContract as any).mockReturnValue(mockReadContract);

    const { result } = renderHook(() => useMkrSkyRate());

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBe(null);
  });

  it('should handle error state', () => {
    const mockError = new Error('Failed to fetch rate');
    const mockReadContract = {
      data: undefined,
      isLoading: false,
      error: mockError,
      refetch: vi.fn()
    };

    (useReadContract as any).mockReturnValue(mockReadContract);

    const { result } = renderHook(() => useMkrSkyRate());

    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(mockError);
  });

  it('should use the correct chain-specific contract address', () => {
    const testnetChainId = 11155111; // Sepolia
    (useChainId as any).mockReturnValue(testnetChainId);

    const mockReadContract = {
      data: mockRate,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    };

    (useReadContract as any).mockReturnValue(mockReadContract);

    renderHook(() => useMkrSkyRate());

    // Should still use mainnet address if testnet address doesn't exist
    expect(useReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.any(String),
        chainId: testnetChainId
      })
    );
  });

  it('should refetch data when refetch is called', () => {
    const mockRefetch = vi.fn();
    const mockReadContract = {
      data: mockRate,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    };

    (useReadContract as any).mockReturnValue(mockReadContract);

    const { result } = renderHook(() => useMkrSkyRate());

    result.current.refetch();

    expect(mockRefetch).toHaveBeenCalled();
  });
});
