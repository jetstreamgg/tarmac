/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStUsdsProviderSelection } from './useStUsdsProviderSelection';
import {
  StUsdsProviderType,
  StUsdsProviderStatus,
  StUsdsSelectionReason,
  StUsdsProviderData,
  StUsdsQuoteParams,
  StUsdsBlockedReason,
  StUsdsDirection
} from './types';
import { RATE_PRECISION } from './constants';

// Mock the provider hooks
vi.mock('./useNativeStUsdsProvider', () => ({
  useNativeStUsdsProvider: vi.fn()
}));

vi.mock('./useCurveStUsdsProvider', () => ({
  useCurveStUsdsProvider: vi.fn()
}));

import { useNativeStUsdsProvider } from './useNativeStUsdsProvider';
import { useCurveStUsdsProvider } from './useCurveStUsdsProvider';

const WAD = RATE_PRECISION.WAD;

// Helper to create mock provider data
const createMockProviderData = (
  type: StUsdsProviderType,
  options: {
    status?: StUsdsProviderStatus;
    canDeposit?: boolean;
    canWithdraw?: boolean;
    inputAmount?: bigint;
    outputAmount?: bigint;
    isValidQuote?: boolean;
    blockedReason?: StUsdsBlockedReason;
  } = {}
): StUsdsProviderData => {
  const {
    status = StUsdsProviderStatus.AVAILABLE,
    canDeposit = true,
    canWithdraw = true,
    inputAmount = 1000n * WAD,
    outputAmount = 1000n * WAD,
    isValidQuote = true,
    blockedReason
  } = options;

  return {
    providerType: type,
    state: {
      providerType: type,
      status,
      canDeposit,
      canWithdraw,
      maxDeposit: canDeposit ? 1000000n * WAD : 0n,
      maxWithdraw: canWithdraw ? 1000000n * WAD : 0n,
      blockedReason
    },
    quote: isValidQuote
      ? {
          providerType: type,
          inputAmount,
          outputAmount,
          rateInfo: {
            outputAmount,
            effectiveRate: inputAmount > 0n ? (outputAmount * WAD) / inputAmount : 0n,
            feeAmount: 0n,
            estimatedSlippageBps: 0,
            priceImpactBps: 0
          },
          isValid: true
        }
      : undefined
  };
};

// Helper to setup mock return values
const setupMocks = (
  nativeData: StUsdsProviderData | undefined,
  curveData: StUsdsProviderData | undefined,
  options: {
    isNativeLoading?: boolean;
    isCurveLoading?: boolean;
    nativeError?: Error | null;
    curveError?: Error | null;
  } = {}
) => {
  const { isNativeLoading = false, isCurveLoading = false, nativeError = null, curveError = null } = options;

  (useNativeStUsdsProvider as ReturnType<typeof vi.fn>).mockReturnValue({
    data: nativeData,
    isLoading: isNativeLoading,
    error: nativeError,
    refetch: vi.fn()
  });

  (useCurveStUsdsProvider as ReturnType<typeof vi.fn>).mockReturnValue({
    data: curveData,
    isLoading: isCurveLoading,
    error: curveError,
    refetch: vi.fn()
  });
};

const defaultParams: StUsdsQuoteParams = {
  amount: 1000n * WAD,
  direction: StUsdsDirection.SUPPLY
};

describe('useStUsdsProviderSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading States', () => {
    it('should indicate loading when native provider is loading', () => {
      setupMocks(undefined, undefined, { isNativeLoading: true });

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.isLoading).toBe(true);
    });

    it('should indicate loading when Curve provider is loading', () => {
      setupMocks(undefined, undefined, { isCurveLoading: true });

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.isLoading).toBe(true);
    });

    it('should indicate loading when both providers are loading', () => {
      setupMocks(undefined, undefined, { isNativeLoading: true, isCurveLoading: true });

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.isLoading).toBe(true);
    });

    it('should not be loading when both providers have loaded', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE);
      const curveData = createMockProviderData(StUsdsProviderType.CURVE);
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should return native error when native provider fails', () => {
      const error = new Error('Native provider error');
      setupMocks(undefined, undefined, { nativeError: error });

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.error).toBe(error);
    });

    it('should return Curve error when Curve provider fails', () => {
      const error = new Error('Curve provider error');
      setupMocks(undefined, undefined, { curveError: error });

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.error).toBe(error);
    });

    it('should return first error when both providers fail', () => {
      const nativeError = new Error('Native error');
      const curveError = new Error('Curve error');
      setupMocks(undefined, undefined, { nativeError, curveError });

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      // Should return the native error (first one checked)
      expect(result.current.error).toBe(nativeError);
    });
  });

  describe('Selection Logic - Native Only Available', () => {
    it('should select native when Curve is blocked for deposits', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        canDeposit: true
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canDeposit: false
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.SUPPLY })
      );

      expect(result.current.selectedProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.NATIVE_ONLY_AVAILABLE);
    });

    it('should select native when Curve is blocked for withdrawals', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        canWithdraw: true
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canWithdraw: false
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.WITHDRAW })
      );

      expect(result.current.selectedProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.NATIVE_ONLY_AVAILABLE);
    });
  });

  describe('Selection Logic - Curve Only Available', () => {
    it('should select Curve when native is blocked for deposits (supply cap reached)', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canDeposit: false,
        blockedReason: StUsdsBlockedReason.SUPPLY_CAPACITY_REACHED
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        canDeposit: true
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.SUPPLY })
      );

      expect(result.current.selectedProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.CURVE_ONLY_AVAILABLE);
    });

    it('should select Curve when native is blocked for withdrawals (liquidity exhausted)', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canWithdraw: false,
        blockedReason: StUsdsBlockedReason.LIQUIDITY_EXHAUSTED
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        canWithdraw: true
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.WITHDRAW })
      );

      expect(result.current.selectedProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.CURVE_ONLY_AVAILABLE);
    });
  });

  describe('Selection Logic - Both Blocked', () => {
    it('should set allProvidersBlocked when both are blocked for deposits', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canDeposit: false,
        blockedReason: StUsdsBlockedReason.SUPPLY_CAPACITY_REACHED
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canDeposit: false,
        blockedReason: StUsdsBlockedReason.CURVE_INSUFFICIENT_STUSDS_LIQUIDITY
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.SUPPLY })
      );

      expect(result.current.allProvidersBlocked).toBe(true);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.ALL_BLOCKED);
    });

    it('should set allProvidersBlocked when both are blocked for withdrawals', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canWithdraw: false,
        blockedReason: StUsdsBlockedReason.LIQUIDITY_EXHAUSTED
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canWithdraw: false,
        blockedReason: StUsdsBlockedReason.CURVE_INSUFFICIENT_USDS_LIQUIDITY
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.WITHDRAW })
      );

      expect(result.current.allProvidersBlocked).toBe(true);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.ALL_BLOCKED);
    });

    it('should default to native provider when both blocked', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canDeposit: false
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canDeposit: false
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.SUPPLY })
      );

      // Should default to native for display purposes
      expect(result.current.selectedProvider).toBe(StUsdsProviderType.NATIVE);
    });
  });

  describe('Selection Logic - Both Available (Rate Comparison)', () => {
    it('should select native by default when rates are equal', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        inputAmount: 1000n * WAD,
        outputAmount: 1000n * WAD
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        inputAmount: 1000n * WAD,
        outputAmount: 1000n * WAD
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.selectedProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.NATIVE_DEFAULT);
    });

    it('should select native when rate difference is below threshold', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        inputAmount: 10000n * WAD,
        outputAmount: 10000n * WAD
      });
      // Curve gives 0.05% better rate (below 0.1% threshold)
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        inputAmount: 10000n * WAD,
        outputAmount: 10005n * WAD
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.selectedProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.NATIVE_DEFAULT);
    });

    it('should select Curve when Curve rate exceeds threshold', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        inputAmount: 10000n * WAD,
        outputAmount: 10000n * WAD
      });
      // Curve gives 0.2% better rate (above 0.1% threshold)
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        inputAmount: 10000n * WAD,
        outputAmount: 10020n * WAD
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.selectedProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.CURVE_BETTER_RATE);
    });

    it('should select native when native rate exceeds threshold', () => {
      // Native gives 0.2% better rate
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        inputAmount: 10000n * WAD,
        outputAmount: 10020n * WAD
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        inputAmount: 10000n * WAD,
        outputAmount: 10000n * WAD
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.selectedProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.NATIVE_BETTER_RATE);
    });

    it('should calculate correct rate difference percent', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        inputAmount: 10000n * WAD,
        outputAmount: 10000n * WAD
      });
      // Curve gives 0.5% better rate
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        inputAmount: 10000n * WAD,
        outputAmount: 10050n * WAD
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.rateDifferencePercent).toBeCloseTo(0.5, 2);
    });
  });

  describe('Selected Quote', () => {
    it('should return native quote when native is selected', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        inputAmount: 1000n * WAD,
        outputAmount: 1000n * WAD
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        inputAmount: 1000n * WAD,
        outputAmount: 990n * WAD // Worse rate
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.selectedQuote?.providerType).toBe(StUsdsProviderType.NATIVE);
    });

    it('should return Curve quote when Curve is selected', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        status: StUsdsProviderStatus.BLOCKED,
        canDeposit: false
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        inputAmount: 1000n * WAD,
        outputAmount: 1000n * WAD
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      expect(result.current.selectedQuote?.providerType).toBe(StUsdsProviderType.CURVE);
    });
  });

  describe('Provider Data Access', () => {
    it('should expose native provider data', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE);
      const curveData = createMockProviderData(StUsdsProviderType.CURVE);
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      // Provider data is merged from selection and quote data, so use toMatchObject
      expect(result.current.nativeProvider).toMatchObject({
        providerType: nativeData.providerType,
        state: nativeData.state
      });
    });

    it('should expose Curve provider data', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE);
      const curveData = createMockProviderData(StUsdsProviderType.CURVE);
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      // Provider data is merged from selection and quote data, so use toMatchObject
      expect(result.current.curveProvider).toMatchObject({
        providerType: curveData.providerType,
        state: curveData.state
      });
    });
  });

  describe('Refetch Functionality', () => {
    it('should provide refetch function', () => {
      const nativeRefetch = vi.fn();
      const curveRefetch = vi.fn();

      (useNativeStUsdsProvider as ReturnType<typeof vi.fn>).mockReturnValue({
        data: createMockProviderData(StUsdsProviderType.NATIVE),
        isLoading: false,
        error: null,
        refetch: nativeRefetch
      });

      (useCurveStUsdsProvider as ReturnType<typeof vi.fn>).mockReturnValue({
        data: createMockProviderData(StUsdsProviderType.CURVE),
        isLoading: false,
        error: null,
        refetch: curveRefetch
      });

      const { result } = renderHook(() => useStUsdsProviderSelection(defaultParams));

      result.current.refetch();

      // Each provider's refetch is called once
      expect(nativeRefetch).toHaveBeenCalledTimes(1);
      expect(curveRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Direction Handling', () => {
    it('should check canDeposit for deposit direction', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        canDeposit: false,
        canWithdraw: true, // Can withdraw but not deposit
        status: StUsdsProviderStatus.BLOCKED
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        canDeposit: true,
        canWithdraw: true
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.SUPPLY })
      );

      // Should select Curve because native can't deposit
      expect(result.current.selectedProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.CURVE_ONLY_AVAILABLE);
    });

    it('should check canWithdraw for withdraw direction', () => {
      const nativeData = createMockProviderData(StUsdsProviderType.NATIVE, {
        canDeposit: true,
        canWithdraw: false, // Can deposit but not withdraw
        status: StUsdsProviderStatus.BLOCKED
      });
      const curveData = createMockProviderData(StUsdsProviderType.CURVE, {
        canDeposit: true,
        canWithdraw: true
      });
      setupMocks(nativeData, curveData);

      const { result } = renderHook(() =>
        useStUsdsProviderSelection({ amount: 1000n * WAD, direction: StUsdsDirection.WITHDRAW })
      );

      // Should select Curve because native can't withdraw
      expect(result.current.selectedProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.current.selectionReason).toBe(StUsdsSelectionReason.CURVE_ONLY_AVAILABLE);
    });
  });
});
