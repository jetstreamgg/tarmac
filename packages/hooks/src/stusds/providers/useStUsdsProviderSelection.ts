import { useMemo } from 'react';
import { useNativeStUsdsProvider } from './useNativeStUsdsProvider';
import { useCurveStUsdsProvider } from './useCurveStUsdsProvider';
import { compareRates } from './rateComparison';
import { STUSDS_PROVIDER_CONFIG } from './constants';
import {
  StUsdsProviderType,
  StUsdsProviderStatus,
  StUsdsSelectionReason,
  StUsdsQuoteParams,
  StUsdsProviderSelectionResult,
  StUsdsDirection
} from './types';

export type StUsdsProviderSelectionParams = StUsdsQuoteParams & {
  /** Reference amount used for rate comparison when actual amount is 0.
   * This prevents UI flicker by allowing provider selection before user input. */
  referenceAmount?: bigint;
  /** User's stUSDS balance for max withdrawals */
  userStUsdsBalance?: bigint;
  /** Whether this is a max withdrawal */
  isMax?: boolean;
};

/**
 * Main orchestration hook that selects the optimal provider for stUSDS operations.
 *
 * Selection logic:
 * 1. If native is blocked and Curve available → select Curve
 * 2. If Curve is blocked and native available → select native
 * 3. If both available → native is default; Curve selected only if its rate exceeds
 *    the threshold
 * 4. If both blocked → set allProvidersBlocked: true
 *
 * @param params - Quote parameters (amount, direction, and optional referenceAmount)
 * @returns Selection result with recommended provider and reasoning
 */
export function useStUsdsProviderSelection(
  params: StUsdsProviderSelectionParams
): StUsdsProviderSelectionResult {
  const { direction, amount, referenceAmount, userStUsdsBalance, isMax } = params;

  // Use reference amount only as fallback when amount is 0
  // Once user has entered an amount, use actual amount for accurate selection
  const selectionAmount = amount > 0n ? amount : (referenceAmount ?? amount);
  const selectionParams: StUsdsQuoteParams = { amount: selectionAmount, direction };

  // Get provider data for selection and quotes
  // Uses selectionAmount which is: actual amount when > 0, reference amount when 0
  const {
    data: nativeData,
    isLoading: isNativeLoading,
    error: nativeError,
    refetch: refetchNative
  } = useNativeStUsdsProvider(selectionParams);

  const {
    data: curveData,
    isLoading: isCurveLoading,
    error: curveError,
    refetch: refetchCurve
  } = useCurveStUsdsProvider({
    ...selectionParams,
    userStUsdsBalance,
    // For rate comparison with reference amount (amount = 0n), use regular quotes, max withdrawal with 0 doesn't work
    // When user has entered an amount, respect their isMax choice
    isMax: amount > 0n ? isMax : false
  });

  // Determine which provider to use
  const selection = useMemo(() => {
    // Default values while loading
    let selectedProvider = StUsdsProviderType.NATIVE;
    let selectionReason = StUsdsSelectionReason.NATIVE_DEFAULT;
    let allProvidersBlocked = false;
    let rateDifferencePercent = 0;

    // Check availability based on direction
    const isNativeAvailable =
      nativeData?.state.status === StUsdsProviderStatus.AVAILABLE &&
      (direction === StUsdsDirection.SUPPLY ? nativeData.state.canDeposit : nativeData.state.canWithdraw);

    const isCurveAvailable =
      curveData?.state.status === StUsdsProviderStatus.AVAILABLE &&
      (direction === StUsdsDirection.SUPPLY ? curveData.state.canDeposit : curveData.state.canWithdraw);

    // Selection logic
    if (!isNativeAvailable && !isCurveAvailable) {
      // Both providers blocked
      allProvidersBlocked = true;
      selectionReason = StUsdsSelectionReason.ALL_BLOCKED;
      // Default to native for display purposes
      selectedProvider = StUsdsProviderType.NATIVE;
    } else if (!isNativeAvailable && isCurveAvailable) {
      // Only Curve available
      selectedProvider = StUsdsProviderType.CURVE;
      selectionReason = StUsdsSelectionReason.CURVE_ONLY_AVAILABLE;
      // Calculate rate difference even when native is blocked
      const comparison = compareRates(nativeData?.quote, curveData?.quote, STUSDS_PROVIDER_CONFIG);
      rateDifferencePercent = comparison.differencePercent;
    } else if (isNativeAvailable && !isCurveAvailable) {
      // Only native available
      selectedProvider = StUsdsProviderType.NATIVE;
      selectionReason = StUsdsSelectionReason.NATIVE_ONLY_AVAILABLE;
    } else {
      // Both available - compare rates
      const comparison = compareRates(nativeData?.quote, curveData?.quote, STUSDS_PROVIDER_CONFIG);

      rateDifferencePercent = comparison.differencePercent;

      const rateExceedsThreshold =
        Math.abs(comparison.differencePercent) >= STUSDS_PROVIDER_CONFIG.rateSwitchThresholdBps / 100;

      if (rateExceedsThreshold && comparison.betterProvider) {
        if (comparison.betterProvider === StUsdsProviderType.CURVE) {
          selectedProvider = StUsdsProviderType.CURVE;
          selectionReason = StUsdsSelectionReason.CURVE_BETTER_RATE;
        } else {
          selectedProvider = StUsdsProviderType.NATIVE;
          selectionReason = StUsdsSelectionReason.NATIVE_BETTER_RATE;
        }
      } else {
        // Rates are similar, prefer native
        selectedProvider = StUsdsProviderType.NATIVE;
        selectionReason = StUsdsSelectionReason.NATIVE_DEFAULT;
      }
    }

    return {
      selectedProvider,
      selectionReason,
      allProvidersBlocked,
      rateDifferencePercent
    };
  }, [nativeData, curveData, direction]);

  const isLoading = isNativeLoading || isCurveLoading;

  const error = nativeError || curveError;

  const refetch = () => {
    refetchNative();
    refetchCurve();
  };

  // Get the quote from the selected provider
  // Only return a quote when there's an actual amount
  const selectedQuote =
    amount > 0n
      ? selection.selectedProvider === StUsdsProviderType.CURVE
        ? curveData?.quote
        : nativeData?.quote
      : undefined;

  return {
    selectedProvider: selection.selectedProvider,
    selectionReason: selection.selectionReason,
    selectedQuote,
    nativeProvider: nativeData,
    curveProvider: curveData,
    allProvidersBlocked: selection.allProvidersBlocked,
    rateDifferencePercent: selection.rateDifferencePercent,
    isSelectionLoading: isLoading,
    isLoading,
    error: error as Error | null,
    refetch
  };
}
