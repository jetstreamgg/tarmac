import { RATE_PRECISION } from './constants';
import { StUsdsProviderType } from './types';
import type { StUsdsQuote, StUsdsRateComparisonConfig } from './types';

/**
 * Result of comparing rates between two providers.
 */
export type RateComparisonResult = {
  /** The provider with the better rate (null if both undefined or equal) */
  betterProvider: StUsdsProviderType | null;
  /** Percentage difference between rates (positive = first provider better) */
  differencePercent: number;
  /** Whether the difference exceeds the minimum threshold to prefer a non-default provider */
  isSignificantDifference: boolean;
};

/**
 * Calculate the effective rate from input/output amounts.
 * Returns rate scaled by 1e18 (WAD precision).
 *
 * @param inputAmount - Amount of input tokens
 * @param outputAmount - Amount of output tokens
 * @returns Effective rate (outputAmount / inputAmount) scaled by 1e18
 */
export function calculateEffectiveRate(inputAmount: bigint, outputAmount: bigint): bigint {
  if (inputAmount === 0n) {
    return 0n;
  }
  return (outputAmount * RATE_PRECISION.WAD) / inputAmount;
}

/**
 * Calculate the percentage difference between two rates.
 *
 * @param rateA - First rate (scaled by 1e18)
 * @param rateB - Second rate (scaled by 1e18)
 * @returns Percentage difference (positive if rateA > rateB)
 */
export function calculateRateDifferencePercent(rateA: bigint, rateB: bigint): number {
  if (rateB === 0n) {
    return rateA > 0n ? 100 : 0;
  }

  // Calculate (rateA - rateB) / rateB * 100
  // Use higher precision to avoid losing decimal places
  const diff = rateA - rateB;
  const percentScaled = (diff * 10000n) / rateB; // Scale by 10000 to get 2 decimal places

  return Number(percentScaled) / 100; // Convert back to percentage with decimals
}

/**
 * Check if a rate difference (in percent) exceeds the threshold.
 *
 * @param differencePercent - Rate difference in percent
 * @param thresholdBps - Threshold in basis points
 * @returns True if the absolute difference exceeds the threshold
 */
export function isRateDifferenceSignificant(differencePercent: number, thresholdBps: number): boolean {
  const thresholdPercent = thresholdBps / 100;
  return Math.abs(differencePercent) >= thresholdPercent;
}

/**
 * Calculate the minimum output amount after applying slippage.
 *
 * @param outputAmount - Expected output amount
 * @param slippageBps - Slippage tolerance in basis points
 * @returns Minimum acceptable output amount
 */
export function calculateMinOutputWithSlippage(outputAmount: bigint, slippageBps: number): bigint {
  const slippageMultiplier = RATE_PRECISION.BPS_DIVISOR - BigInt(slippageBps);
  return (outputAmount * slippageMultiplier) / RATE_PRECISION.BPS_DIVISOR;
}

/**
 * Compare rates between native and Curve providers.
 *
 * @param nativeQuote - Quote from native provider (or undefined if unavailable)
 * @param curveQuote - Quote from Curve provider (or undefined if unavailable)
 * @param config - Rate comparison configuration
 * @returns Comparison result indicating which provider is better
 */
export function compareRates(
  nativeQuote: StUsdsQuote | undefined,
  curveQuote: StUsdsQuote | undefined,
  config: StUsdsRateComparisonConfig
): RateComparisonResult {
  // Handle cases where quotes are completely missing
  if (!nativeQuote && !curveQuote) {
    return {
      betterProvider: null,
      differencePercent: 0,
      isSignificantDifference: false
    };
  }

  // Check if we have rate information for both quotes
  const hasBothRates =
    nativeQuote?.rateInfo?.effectiveRate !== undefined && curveQuote?.rateInfo?.effectiveRate !== undefined;

  if (hasBothRates) {
    const nativeRate = nativeQuote!.rateInfo.effectiveRate;
    const curveRate = curveQuote!.rateInfo.effectiveRate;

    // Positive difference means Curve is better
    const differencePercent = calculateRateDifferencePercent(curveRate, nativeRate);
    const isSignificant = isRateDifferenceSignificant(differencePercent, config.rateSwitchThresholdBps);

    // Special case: if one quote is invalid or has zero output, it's always significant
    const nativeHasZeroOutput = nativeQuote!.outputAmount === 0n;
    const curveHasZeroOutput = curveQuote!.outputAmount === 0n;
    const oneHasZeroOutput =
      (nativeHasZeroOutput && !curveHasZeroOutput) || (!nativeHasZeroOutput && curveHasZeroOutput);

    // Determine better provider based on validity and rates
    let betterProvider: StUsdsProviderType | null = null;

    if (!nativeQuote!.isValid && !curveQuote!.isValid) {
      // Neither is valid, no clear better provider
      betterProvider = null;
    } else if (!nativeQuote!.isValid) {
      // Only Curve is valid
      betterProvider = StUsdsProviderType.CURVE;
    } else if (!curveQuote!.isValid) {
      // Only Native is valid
      betterProvider = StUsdsProviderType.NATIVE;
    } else if (nativeHasZeroOutput && !curveHasZeroOutput) {
      // Native gives 0 output, prefer Curve
      betterProvider = StUsdsProviderType.CURVE;
    } else if (!nativeHasZeroOutput && curveHasZeroOutput) {
      // Curve gives 0 output, prefer Native
      betterProvider = StUsdsProviderType.NATIVE;
    } else if (nativeRate === curveRate) {
      // Both valid with equal rates - no preference
      betterProvider = null;
    } else if (isSignificant) {
      // Both valid, pick based on rate
      betterProvider = differencePercent > 0 ? StUsdsProviderType.CURVE : StUsdsProviderType.NATIVE;
    }

    return {
      betterProvider,
      differencePercent,
      isSignificantDifference:
        isSignificant || nativeQuote!.isValid !== curveQuote!.isValid || oneHasZeroOutput
    };
  }

  // Fallback for missing rate information - one quote is undefined
  if (!nativeQuote || !nativeQuote.rateInfo?.effectiveRate) {
    return {
      betterProvider: curveQuote?.isValid ? StUsdsProviderType.CURVE : null,
      differencePercent: 0,
      isSignificantDifference: true // Missing quote is always significant
    };
  }

  if (!curveQuote || !curveQuote.rateInfo?.effectiveRate) {
    return {
      betterProvider: nativeQuote?.isValid ? StUsdsProviderType.NATIVE : null,
      differencePercent: 0,
      isSignificantDifference: true // Missing quote is always significant
    };
  }

  // Should not reach here
  return {
    betterProvider: null,
    differencePercent: 0,
    isSignificantDifference: false
  };
}
