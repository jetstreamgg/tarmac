/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCurveQuote } from './useCurveQuote';
import { RATE_PRECISION } from './constants';
import { StUsdsDirection } from './types';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useChainId: vi.fn(() => 1)
}));

// Mock generated hooks
vi.mock('../../generated', () => ({
  useReadCurveStUsdsUsdsPoolGetDy: vi.fn(),
  useReadCurveStUsdsUsdsPoolGetDx: vi.fn()
}));

// Mock useCurvePoolData
vi.mock('./useCurvePoolData', () => ({
  useCurvePoolData: vi.fn()
}));

// Mock isTestnetId
vi.mock('@jetstreamgg/sky-utils', () => ({
  isTestnetId: vi.fn(() => false)
}));

import { useReadCurveStUsdsUsdsPoolGetDy, useReadCurveStUsdsUsdsPoolGetDx } from '../../generated';
import { useCurvePoolData } from './useCurvePoolData';

describe('useCurveQuote', () => {
  const WAD = RATE_PRECISION.WAD;
  const BPS = RATE_PRECISION.BPS_DIVISOR;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default pool data mock
    (useCurvePoolData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        usdsReserve: 1000000n * WAD,
        stUsdsReserve: 950000n * WAD,
        fee: 4000000n,
        adminFee: 5000000000n,
        coin0: '0x0000000000000000000000000000000000000001',
        coin1: '0x0000000000000000000000000000000000000002',
        tokenIndices: { usds: 0, stUsds: 1 }
      },
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    // Default mocks for both get_dy and get_dx
    (useReadCurveStUsdsUsdsPoolGetDy as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });

    (useReadCurveStUsdsUsdsPoolGetDx as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn()
    });
  });

  describe('deposit quote (USDS -> stUSDS)', () => {
    it('should return correct quote for deposit', () => {
      const usdsAmount = 1000n * WAD;
      const stUsdsOutput = 950n * WAD; // Approximate after fees

      (useReadCurveStUsdsUsdsPoolGetDy as ReturnType<typeof vi.fn>).mockReturnValue({
        data: stUsdsOutput,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: usdsAmount,
          enabled: true
        })
      );

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.usdsAmount).toBe(usdsAmount);
      expect(result.current.data?.stUsdsAmount).toBe(stUsdsOutput);
      expect(result.current.data?.effectiveRate).toBe((stUsdsOutput * WAD) / usdsAmount);
      expect(result.current.isLoading).toBe(false);
    });

    it('should calculate price impact for deposit using referenceRate', () => {
      const usdsAmount = 1000n * WAD;
      const referenceRate = (105n * WAD) / 100n; // 1.05 USDS per stUSDS
      const expectedRate = (WAD * WAD) / referenceRate; // ~0.952 * WAD (stUSDS per USDS)

      // Actual output is less due to fees/slippage
      const stUsdsOutput = 940n * WAD;
      const actualRate = (stUsdsOutput * WAD) / usdsAmount; // 0.94 * WAD

      (useReadCurveStUsdsUsdsPoolGetDy as ReturnType<typeof vi.fn>).mockReturnValue({
        data: stUsdsOutput,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: usdsAmount,
          enabled: true,
          referenceRate
        })
      );

      expect(result.current.data?.priceImpactBps).toBeGreaterThan(0);
      const expectedImpact = Number(((expectedRate - actualRate) * BPS) / expectedRate);
      expect(result.current.data?.priceImpactBps).toBeCloseTo(expectedImpact, 0);
    });

    it('should return 0 price impact when no referenceRate provided', () => {
      const usdsAmount = 1000n * WAD;
      const stUsdsOutput = 940n * WAD;

      (useReadCurveStUsdsUsdsPoolGetDy as ReturnType<typeof vi.fn>).mockReturnValue({
        data: stUsdsOutput,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: usdsAmount,
          enabled: true
          // No referenceRate provided
        })
      );

      expect(result.current.data?.priceImpactBps).toBe(0);
    });
  });

  describe('withdraw quote (stUSDS -> USDS)', () => {
    it('should return correct quote for withdraw using get_dx', () => {
      const desiredUsdsOutput = 1000n * WAD;
      const requiredStUsdsInput = 960n * WAD; // Calculated via get_dx

      (useReadCurveStUsdsUsdsPoolGetDx as ReturnType<typeof vi.fn>).mockReturnValue({
        data: requiredStUsdsInput,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.WITHDRAW,
          amount: desiredUsdsOutput,
          enabled: true
        })
      );

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.usdsAmount).toBe(desiredUsdsOutput);
      expect(result.current.data?.stUsdsAmount).toBe(requiredStUsdsInput);
      // Rate: USDS per stUSDS
      expect(result.current.data?.effectiveRate).toBe((desiredUsdsOutput * WAD) / requiredStUsdsInput);
    });

    it('should calculate price impact for withdraw using referenceRate', () => {
      const desiredUsdsOutput = 1000n * WAD;
      const referenceRate = (105n * WAD) / 100n; // 1.05 USDS per stUSDS
      // Required stUSDS is more than expected due to fees
      const requiredStUsdsInput = 970n * WAD;
      const actualRate = (desiredUsdsOutput * WAD) / requiredStUsdsInput;

      (useReadCurveStUsdsUsdsPoolGetDx as ReturnType<typeof vi.fn>).mockReturnValue({
        data: requiredStUsdsInput,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.WITHDRAW,
          amount: desiredUsdsOutput,
          enabled: true,
          referenceRate
        })
      );

      expect(result.current.data?.priceImpactBps).toBeGreaterThan(0);
      const expectedImpact = Number(((referenceRate - actualRate) * BPS) / referenceRate);
      expect(result.current.data?.priceImpactBps).toBeCloseTo(expectedImpact, 0);
    });
  });

  describe('edge cases', () => {
    it('should return undefined when amount is 0', () => {
      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: 0n,
          enabled: true
        })
      );

      expect(result.current.data).toBeUndefined();
    });

    it('should return undefined when deposit output is undefined', () => {
      (useReadCurveStUsdsUsdsPoolGetDy as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: 1000n * WAD,
          enabled: true
        })
      );

      expect(result.current.data).toBeUndefined();
    });

    it('should return undefined when withdraw input is undefined', () => {
      (useReadCurveStUsdsUsdsPoolGetDx as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.WITHDRAW,
          amount: 1000n * WAD,
          enabled: true
        })
      );

      expect(result.current.data).toBeUndefined();
    });

    it('should not calculate price impact when getting better than reference rate', () => {
      const desiredUsdsOutput = 1000n * WAD;
      const referenceRate = (105n * WAD) / 100n; // 1.05 USDS per stUSDS
      // Required stUSDS is less than expected (better rate - getting more USDS per stUSDS)
      const requiredStUsdsInput = 940n * WAD;

      (useReadCurveStUsdsUsdsPoolGetDx as ReturnType<typeof vi.fn>).mockReturnValue({
        data: requiredStUsdsInput,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.WITHDRAW,
          amount: desiredUsdsOutput,
          enabled: true,
          referenceRate
        })
      );

      // When getting better rate, price impact should be 0
      expect(result.current.data?.priceImpactBps).toBe(0);
    });

    it('should handle zero referenceRate gracefully', () => {
      const usdsAmount = 1000n * WAD;
      const stUsdsOutput = 950n * WAD;

      (useReadCurveStUsdsUsdsPoolGetDy as ReturnType<typeof vi.fn>).mockReturnValue({
        data: stUsdsOutput,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: usdsAmount,
          enabled: true,
          referenceRate: 0n
        })
      );

      expect(result.current.data?.priceImpactBps).toBe(0);
    });
  });

  describe('loading state', () => {
    it('should show loading when pool data is loading', () => {
      (useCurvePoolData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: 1000n * WAD,
          enabled: true
        })
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('should show loading when deposit quote is loading', () => {
      (useReadCurveStUsdsUsdsPoolGetDy as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: 1000n * WAD,
          enabled: true
        })
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('should show loading when withdraw quote is loading', () => {
      (useReadCurveStUsdsUsdsPoolGetDx as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn()
      });

      const { result } = renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.WITHDRAW,
          amount: 1000n * WAD,
          enabled: true
        })
      );

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('disabled state', () => {
    it('should not fetch deposit quote when disabled', () => {
      const getDyMock = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      (useReadCurveStUsdsUsdsPoolGetDy as ReturnType<typeof vi.fn>).mockImplementation(getDyMock);

      renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.SUPPLY,
          amount: 1000n * WAD,
          enabled: false
        })
      );

      expect(getDyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            enabled: false
          })
        })
      );
    });

    it('should not fetch withdraw quote when disabled', () => {
      const getDxMock = vi.fn().mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: vi.fn()
      });

      (useReadCurveStUsdsUsdsPoolGetDx as ReturnType<typeof vi.fn>).mockImplementation(getDxMock);

      renderHook(() =>
        useCurveQuote({
          direction: StUsdsDirection.WITHDRAW,
          amount: 1000n * WAD,
          enabled: false
        })
      );

      expect(getDxMock).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            enabled: false
          })
        })
      );
    });
  });
});
