/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurveAllowance } from './useCurveAllowance';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({ address: '0x1234567890123456789012345678901234567890' })),
  useChainId: vi.fn(() => 1)
}));

// Mock generated addresses
vi.mock('../../generated', () => ({
  usdsAddress: { 1: '0xdC035D45d973E3EC169d2276DDab16f1e407384F' },
  stUsdsAddress: { 1: '0x0000000000000000000000000000000000000001' },
  curveStUsdsUsdsPoolAddress: { 1: '0x2C7C98A3b1582D83c43987202aEFf638312478aE' }
}));

// Mock useTokenAllowance
vi.mock('../../tokens/useTokenAllowance', () => ({
  useTokenAllowance: vi.fn()
}));

// Mock isTestnetId
vi.mock('@jetstreamgg/sky-utils', () => ({
  isTestnetId: vi.fn(() => false)
}));

import { useTokenAllowance } from '../../tokens/useTokenAllowance';
import { useAccount } from 'wagmi';

describe('useCurveAllowance', () => {
  const WAD = 10n ** 18n;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hasAllowance calculation', () => {
    it('should return hasAllowance true when allowance >= amount', () => {
      const allowanceAmount = 1000n * WAD;
      const checkAmount = 500n * WAD;

      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: allowanceAmount,
        isLoading: false,
        error: null,
        dataSources: []
      });

      const { result } = renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: checkAmount
        })
      );

      expect(result.current.hasAllowance).toBe(true);
      expect(result.current.data).toBe(allowanceAmount);
    });

    it('should return hasAllowance false when allowance < amount', () => {
      const allowanceAmount = 500n * WAD;
      const checkAmount = 1000n * WAD;

      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: allowanceAmount,
        isLoading: false,
        error: null,
        dataSources: []
      });

      const { result } = renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: checkAmount
        })
      );

      expect(result.current.hasAllowance).toBe(false);
    });

    it('should return hasAllowance true when allowance equals amount', () => {
      const amount = 1000n * WAD;

      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: amount,
        isLoading: false,
        error: null,
        dataSources: []
      });

      const { result } = renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount
        })
      );

      expect(result.current.hasAllowance).toBe(true);
    });

    it('should return hasAllowance false when amount is 0', () => {
      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: 1000n * WAD,
        isLoading: false,
        error: null,
        dataSources: []
      });

      const { result } = renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 0n
        })
      );

      // hasAllowance should be false when amount is 0 (no allowance needed)
      expect(result.current.hasAllowance).toBe(false);
    });

    it('should return hasAllowance false when data is undefined', () => {
      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        dataSources: []
      });

      const { result } = renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 1000n * WAD
        })
      );

      expect(result.current.hasAllowance).toBe(false);
    });
  });

  describe('token selection', () => {
    it('should check USDS allowance for USDS token', () => {
      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: 1000n * WAD,
        isLoading: false,
        error: null,
        dataSources: []
      });

      renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 500n * WAD
        })
      );

      expect(useTokenAllowance).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: '0xdC035D45d973E3EC169d2276DDab16f1e407384F'
        })
      );
    });

    it('should check stUSDS allowance for stUSDS token', () => {
      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: 1000n * WAD,
        isLoading: false,
        error: null,
        dataSources: []
      });

      renderHook(() =>
        useCurveAllowance({
          token: 'stUSDS',
          amount: 500n * WAD
        })
      );

      expect(useTokenAllowance).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: '0x0000000000000000000000000000000000000001'
        })
      );
    });
  });

  describe('spender address', () => {
    it('should use Curve pool as spender', () => {
      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: 1000n * WAD,
        isLoading: false,
        error: null,
        dataSources: []
      });

      renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 500n * WAD
        })
      );

      expect(useTokenAllowance).toHaveBeenCalledWith(
        expect.objectContaining({
          spender: '0x2C7C98A3b1582D83c43987202aEFf638312478aE'
        })
      );
    });
  });

  describe('custom owner address', () => {
    it('should use connected address by default', () => {
      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: 1000n * WAD,
        isLoading: false,
        error: null,
        dataSources: []
      });

      renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 500n * WAD
        })
      );

      expect(useTokenAllowance).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: '0x1234567890123456789012345678901234567890'
        })
      );
    });

    it('should use provided address when specified', () => {
      const customAddress = '0xABCDEF0123456789012345678901234567890ABC' as `0x${string}`;

      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: 1000n * WAD,
        isLoading: false,
        error: null,
        dataSources: []
      });

      renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 500n * WAD,
          address: customAddress
        })
      );

      expect(useTokenAllowance).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: customAddress
        })
      );
    });

    it('should use zero address when no wallet connected', () => {
      (useAccount as ReturnType<typeof vi.fn>).mockReturnValue({ address: undefined });

      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        dataSources: []
      });

      renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 500n * WAD
        })
      );

      expect(useTokenAllowance).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: '0x0000000000000000000000000000000000000000'
        })
      );
    });
  });

  describe('loading and error states', () => {
    it('should pass through loading state', () => {
      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        dataSources: []
      });

      const { result } = renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 500n * WAD
        })
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('should pass through error state', () => {
      const testError = new Error('Failed to fetch allowance');

      (useTokenAllowance as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: testError,
        dataSources: []
      });

      const { result } = renderHook(() =>
        useCurveAllowance({
          token: 'USDS',
          amount: 500n * WAD
        })
      );

      expect(result.current.error).toBe(testError);
    });
  });
});
