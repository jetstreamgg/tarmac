/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurvePoolData } from './useCurvePoolData';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useChainId: vi.fn(() => 1),
  useReadContracts: vi.fn()
}));

// Mock generated hooks
vi.mock('../../generated', () => ({
  curveStUsdsUsdsPoolAddress: { 1: '0x2C7C98A3b1582D83c43987202aEFf638312478aE' },
  curveStUsdsUsdsPoolAbi: [],
  usdsAddress: { 1: '0xdC035D45d973E3EC169d2276DDab16f1e407384F' }
}));

// Mock isTestnetId
vi.mock('@jetstreamgg/sky-utils', () => ({
  isTestnetId: vi.fn(() => false)
}));

import { useReadContracts } from 'wagmi';

describe('useCurvePoolData', () => {
  const WAD = 10n ** 18n;
  const mockUsdsAddress = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
  const mockStUsdsAddress = '0x0000000000000000000000000000000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful data fetch', () => {
    it('should return pool data when all calls succeed', () => {
      const mockBalance0 = 1000000n * WAD;
      const mockBalance1 = 950000n * WAD;
      const mockFee = 4000000n; // 0.04%
      const mockAdminFee = 5000000000n;

      (useReadContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [
          { result: mockBalance0, status: 'success' },
          { result: mockBalance1, status: 'success' },
          { result: mockFee, status: 'success' },
          { result: mockAdminFee, status: 'success' },
          { result: mockUsdsAddress, status: 'success' },
          { result: mockStUsdsAddress, status: 'success' }
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() => useCurvePoolData());

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.usdsReserve).toBe(mockBalance0);
      expect(result.current.data?.stUsdsReserve).toBe(mockBalance1);
      expect(result.current.data?.fee).toBe(mockFee);
      expect(result.current.data?.adminFee).toBe(mockAdminFee);
      expect(result.current.data?.tokenIndices.usds).toBe(0);
      expect(result.current.data?.tokenIndices.stUsds).toBe(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should correctly identify token indices when USDS is at index 1', () => {
      const mockBalance0 = 950000n * WAD;
      const mockBalance1 = 1000000n * WAD;

      (useReadContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [
          { result: mockBalance0, status: 'success' },
          { result: mockBalance1, status: 'success' },
          { result: 4000000n, status: 'success' },
          { result: 5000000000n, status: 'success' },
          { result: mockStUsdsAddress, status: 'success' }, // coin0 is stUSDS
          { result: mockUsdsAddress, status: 'success' } // coin1 is USDS
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() => useCurvePoolData());

      expect(result.current.data?.tokenIndices.usds).toBe(1);
      expect(result.current.data?.tokenIndices.stUsds).toBe(0);
      expect(result.current.data?.usdsReserve).toBe(mockBalance1);
      expect(result.current.data?.stUsdsReserve).toBe(mockBalance0);
    });
  });

  describe('loading state', () => {
    it('should return isLoading true when fetching', () => {
      (useReadContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() => useCurvePoolData());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should return undefined data when readData is undefined', () => {
      (useReadContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() => useCurvePoolData());

      expect(result.current.data).toBeUndefined();
    });

    it('should return undefined data when any call fails', () => {
      (useReadContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [
          { result: 1000000n * WAD, status: 'success' },
          { result: 950000n * WAD, status: 'success' },
          { result: undefined, status: 'failure', error: new Error('Call failed') },
          { result: 5000000000n, status: 'success' },
          { result: mockUsdsAddress, status: 'success' },
          { result: mockStUsdsAddress, status: 'success' }
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() => useCurvePoolData());

      expect(result.current.data).toBeUndefined();
    });

    it('should pass through error from useReadContracts', () => {
      const testError = new Error('RPC Error');

      (useReadContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: testError,
        refetch: vi.fn()
      });

      const { result } = renderHook(() => useCurvePoolData());

      expect(result.current.error).toBe(testError);
    });
  });

  describe('refetch', () => {
    it('should provide a refetch function', () => {
      const mockRefetch = vi.fn();

      (useReadContracts as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      });

      const { result } = renderHook(() => useCurvePoolData());

      result.current.refetch();
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
