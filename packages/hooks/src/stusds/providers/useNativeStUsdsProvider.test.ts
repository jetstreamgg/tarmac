/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNativeStUsdsProvider } from './useNativeStUsdsProvider';
import { StUsdsProviderType, StUsdsProviderStatus, StUsdsBlockedReason, StUsdsDirection } from './types';
import { RATE_PRECISION } from './constants';

// Mock the stUSDS data hooks
vi.mock('../useStUsdsData', () => ({
  useStUsdsData: vi.fn()
}));

vi.mock('../useStUsdsCapacityData', () => ({
  useStUsdsCapacityData: vi.fn()
}));

vi.mock('../useStUsdsPreviewDeposit', () => ({
  useStUsdsPreviewDeposit: vi.fn()
}));

vi.mock('../useStUsdsPreviewWithdraw', () => ({
  useStUsdsPreviewWithdraw: vi.fn()
}));

import { useStUsdsData } from '../useStUsdsData';
import { useStUsdsCapacityData } from '../useStUsdsCapacityData';
import { useStUsdsPreviewDeposit } from '../useStUsdsPreviewDeposit';
import { useStUsdsPreviewWithdraw } from '../useStUsdsPreviewWithdraw';

describe('useNativeStUsdsProvider', () => {
  const WAD = RATE_PRECISION.WAD;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        availableLiquidityBuffered: 1000000n * WAD,
        userMaxWithdrawBuffered: 500000n * WAD
      },
      isLoading: false,
      error: null,
      mutate: vi.fn()
    });

    (useStUsdsCapacityData as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        remainingCapacityBuffered: 500000n * WAD
      },
      isLoading: false,
      error: null,
      mutate: vi.fn()
    });

    (useStUsdsPreviewDeposit as ReturnType<typeof vi.fn>).mockReturnValue({
      data: 950n * WAD,
      isLoading: false,
      error: null,
      mutate: vi.fn()
    });

    (useStUsdsPreviewWithdraw as ReturnType<typeof vi.fn>).mockReturnValue({
      data: 1050n * WAD,
      isLoading: false,
      error: null,
      mutate: vi.fn()
    });
  });

  describe('provider type', () => {
    it('should return NATIVE provider type', () => {
      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data?.providerType).toBe(StUsdsProviderType.NATIVE);
      expect(result.current.data?.state.providerType).toBe(StUsdsProviderType.NATIVE);
    });
  });

  describe('deposit availability', () => {
    it('should be available when capacity > 0', () => {
      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data?.state.status).toBe(StUsdsProviderStatus.AVAILABLE);
      expect(result.current.data?.state.canDeposit).toBe(true);
    });

    it('should be blocked when capacity = 0', () => {
      (useStUsdsCapacityData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
          remainingCapacityBuffered: 0n
        },
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data?.state.status).toBe(StUsdsProviderStatus.BLOCKED);
      expect(result.current.data?.state.canDeposit).toBe(false);
      expect(result.current.data?.state.blockedReason).toBe(StUsdsBlockedReason.SUPPLY_CAPACITY_REACHED);
    });

    it('should be blocked when amount exceeds capacity', () => {
      (useStUsdsCapacityData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
          remainingCapacityBuffered: 500n * WAD
        },
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data?.state.status).toBe(StUsdsProviderStatus.BLOCKED);
      expect(result.current.data?.state.canDeposit).toBe(false);
      expect(result.current.data?.state.blockedReason).toBe(
        StUsdsBlockedReason.AMOUNT_EXCEEDS_SUPPLY_CAPACITY
      );
    });
  });

  describe('withdraw availability', () => {
    it('should be available when liquidity > 0', () => {
      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.WITHDRAW
        })
      );

      expect(result.current.data?.state.status).toBe(StUsdsProviderStatus.AVAILABLE);
      expect(result.current.data?.state.canWithdraw).toBe(true);
    });

    it('should be blocked when liquidity = 0', () => {
      (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
          availableLiquidityBuffered: 0n,
          userMaxWithdrawBuffered: 0n
        },
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.WITHDRAW
        })
      );

      expect(result.current.data?.state.status).toBe(StUsdsProviderStatus.BLOCKED);
      expect(result.current.data?.state.canWithdraw).toBe(false);
      expect(result.current.data?.state.blockedReason).toBe(StUsdsBlockedReason.LIQUIDITY_EXHAUSTED);
    });

    it('should be blocked when amount exceeds liquidity', () => {
      (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
          availableLiquidityBuffered: 500n * WAD,
          userMaxWithdrawBuffered: 500n * WAD
        },
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.WITHDRAW
        })
      );

      expect(result.current.data?.state.status).toBe(StUsdsProviderStatus.BLOCKED);
      expect(result.current.data?.state.canWithdraw).toBe(false);
      expect(result.current.data?.state.blockedReason).toBe(StUsdsBlockedReason.AMOUNT_EXCEEDS_LIQUIDITY);
    });
  });

  describe('quote generation', () => {
    it('should generate valid deposit quote', () => {
      const inputAmount = 1000n * WAD;
      const outputAmount = 950n * WAD;

      (useStUsdsPreviewDeposit as ReturnType<typeof vi.fn>).mockReturnValue({
        data: outputAmount,
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: inputAmount,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data?.quote).toBeDefined();
      expect(result.current.data?.quote?.inputAmount).toBe(inputAmount);
      expect(result.current.data?.quote?.outputAmount).toBe(outputAmount);
      expect(result.current.data?.quote?.isValid).toBe(true);
      expect(result.current.data?.quote?.rateInfo.effectiveRate).toBe((outputAmount * WAD) / inputAmount);
    });

    it('should generate valid withdraw quote', () => {
      const requestedUsds = 1000n * WAD; // User wants to withdraw 1000 USDS
      const stUsdsNeeded = 1050n * WAD; // previewWithdraw returns shares needed

      (useStUsdsPreviewWithdraw as ReturnType<typeof vi.fn>).mockReturnValue({
        data: stUsdsNeeded,
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: requestedUsds,
          direction: StUsdsDirection.WITHDRAW
        })
      );

      expect(result.current.data?.quote).toBeDefined();
      expect(result.current.data?.quote?.inputAmount).toBe(stUsdsNeeded); // For withdraw, input is stUSDS shares
      expect(result.current.data?.quote?.outputAmount).toBe(requestedUsds); // Output is USDS amount
      expect(result.current.data?.quote?.isValid).toBe(true);
    });

    it('should not generate quote when amount is 0', () => {
      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 0n,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data?.quote).toBeUndefined();
    });

    it('should mark quote invalid when amount exceeds capacity', () => {
      const maxCapacity = 500n * WAD;
      const requestedAmount = 1000n * WAD;

      (useStUsdsCapacityData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
          remainingCapacityBuffered: maxCapacity
        },
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: requestedAmount,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data?.quote?.isValid).toBe(false);
      expect(result.current.data?.quote?.invalidReason).toBe('Amount exceeds remaining capacity');
    });

    it('should mark quote invalid when amount exceeds withdrawable', () => {
      const maxWithdraw = 500n * WAD;
      const requestedAmount = 1000n * WAD;

      (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
          availableLiquidityBuffered: 1000000n * WAD,
          userMaxWithdrawBuffered: maxWithdraw
        },
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: requestedAmount,
          direction: StUsdsDirection.WITHDRAW
        })
      );

      expect(result.current.data?.quote?.isValid).toBe(false);
      expect(result.current.data?.quote?.invalidReason).toBe('Amount exceeds available liquidity');
    });
  });

  describe('rate info', () => {
    it('should have zero fees and slippage for native provider', () => {
      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data?.quote?.rateInfo.feeAmount).toBe(0n);
      expect(result.current.data?.quote?.rateInfo.estimatedSlippageBps).toBe(0);
      expect(result.current.data?.quote?.rateInfo.priceImpactBps).toBe(0);
    });
  });

  describe('loading state', () => {
    it('should be loading when data is loading', () => {
      (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('should be loading when capacity is loading', () => {
      (useStUsdsCapacityData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.isLoading).toBe(true);
    });

    it('should be loading when deposit preview is loading for deposit direction', () => {
      (useStUsdsPreviewDeposit as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return undefined data when stUsdsData is undefined', () => {
      (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data).toBeUndefined();
    });

    it('should return undefined data when capacityData is undefined', () => {
      (useStUsdsCapacityData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.data).toBeUndefined();
    });

    it('should pass through errors', () => {
      const testError = new Error('Data fetch failed');

      (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: testError,
        mutate: vi.fn()
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      expect(result.current.error).toBe(testError);
    });
  });

  describe('refetch', () => {
    it('should call all refetch functions', () => {
      const refetchData = vi.fn();
      const refetchCapacity = vi.fn();
      const refetchDeposit = vi.fn();
      const refetchWithdraw = vi.fn();

      (useStUsdsData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: { availableLiquidityBuffered: 1000n * WAD, userMaxWithdrawBuffered: 500n * WAD },
        isLoading: false,
        error: null,
        mutate: refetchData
      });

      (useStUsdsCapacityData as ReturnType<typeof vi.fn>).mockReturnValue({
        data: { remainingCapacityBuffered: 500n * WAD },
        isLoading: false,
        error: null,
        mutate: refetchCapacity
      });

      (useStUsdsPreviewDeposit as ReturnType<typeof vi.fn>).mockReturnValue({
        data: 950n * WAD,
        isLoading: false,
        error: null,
        mutate: refetchDeposit
      });

      (useStUsdsPreviewWithdraw as ReturnType<typeof vi.fn>).mockReturnValue({
        data: 1050n * WAD,
        isLoading: false,
        error: null,
        mutate: refetchWithdraw
      });

      const { result } = renderHook(() =>
        useNativeStUsdsProvider({
          amount: 1000n * WAD,
          direction: StUsdsDirection.SUPPLY
        })
      );

      result.current.refetch();

      expect(refetchData).toHaveBeenCalled();
      expect(refetchCapacity).toHaveBeenCalled();
      expect(refetchDeposit).toHaveBeenCalled();
      expect(refetchWithdraw).toHaveBeenCalled();
    });
  });
});
