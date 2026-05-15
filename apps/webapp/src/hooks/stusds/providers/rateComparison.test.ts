import { describe, expect, it } from 'vitest';
import {
  calculateEffectiveRate,
  calculateRateDifferencePercent,
  isRateDifferenceSignificant,
  calculateMinOutputWithSlippage,
  compareRates
} from './rateComparison';
import { StUsdsProviderType, StUsdsQuote } from './types';
import { RATE_PRECISION, STUSDS_PROVIDER_CONFIG } from './constants';

// Helper to create a mock quote
const createMockQuote = (
  provider: StUsdsProviderType,
  inputAmount: bigint,
  outputAmount: bigint,
  isValid = true
): StUsdsQuote => ({
  providerType: provider,
  inputAmount,
  outputAmount,
  rateInfo: {
    outputAmount,
    effectiveRate: inputAmount > 0n ? (outputAmount * RATE_PRECISION.WAD) / inputAmount : 0n,
    feeAmount: 0n,
    estimatedSlippageBps: 0,
    priceImpactBps: 0
  },
  isValid,
  invalidReason: isValid ? undefined : 'Test invalid reason'
});

describe('Rate Comparison Utilities', () => {
  describe('calculateEffectiveRate', () => {
    it('should calculate rate correctly for equal amounts', () => {
      const input = 1000n * RATE_PRECISION.WAD;
      const output = 1000n * RATE_PRECISION.WAD;

      const rate = calculateEffectiveRate(input, output);

      // 1:1 rate should be exactly WAD (1e18)
      expect(rate).toBe(RATE_PRECISION.WAD);
    });

    it('should calculate rate correctly when output > input', () => {
      const input = 1000n * RATE_PRECISION.WAD;
      const output = 1010n * RATE_PRECISION.WAD; // 1% more

      const rate = calculateEffectiveRate(input, output);

      // Rate should be 1.01 * WAD
      expect(rate).toBe((101n * RATE_PRECISION.WAD) / 100n);
    });

    it('should calculate rate correctly when output < input', () => {
      const input = 1000n * RATE_PRECISION.WAD;
      const output = 990n * RATE_PRECISION.WAD; // 1% less

      const rate = calculateEffectiveRate(input, output);

      // Rate should be 0.99 * WAD
      expect(rate).toBe((99n * RATE_PRECISION.WAD) / 100n);
    });

    it('should return 0 for zero input', () => {
      const rate = calculateEffectiveRate(0n, 1000n * RATE_PRECISION.WAD);
      expect(rate).toBe(0n);
    });

    it('should return 0 for zero output', () => {
      const rate = calculateEffectiveRate(1000n * RATE_PRECISION.WAD, 0n);
      expect(rate).toBe(0n);
    });

    it('should handle very small amounts', () => {
      const input = 1n;
      const output = 1n;

      const rate = calculateEffectiveRate(input, output);

      expect(rate).toBe(RATE_PRECISION.WAD);
    });

    it('should handle very large amounts', () => {
      const input = 10n ** 30n; // 1 trillion tokens with 18 decimals
      const output = 10n ** 30n;

      const rate = calculateEffectiveRate(input, output);

      expect(rate).toBe(RATE_PRECISION.WAD);
    });

    it('should handle asymmetric amounts (small input, large output)', () => {
      const input = 1n * RATE_PRECISION.WAD;
      const output = 1000n * RATE_PRECISION.WAD;

      const rate = calculateEffectiveRate(input, output);

      // Rate should be 1000 * WAD
      expect(rate).toBe(1000n * RATE_PRECISION.WAD);
    });

    it('should handle asymmetric amounts (large input, small output)', () => {
      const input = 1000n * RATE_PRECISION.WAD;
      const output = 1n * RATE_PRECISION.WAD;

      const rate = calculateEffectiveRate(input, output);

      // Rate should be 0.001 * WAD
      expect(rate).toBe(RATE_PRECISION.WAD / 1000n);
    });

    it('should handle both zero input and output', () => {
      const rate = calculateEffectiveRate(0n, 0n);
      expect(rate).toBe(0n);
    });

    it('should handle realistic stUSDS exchange rate (1 stUSDS = 1.05 USDS)', () => {
      // Depositing 1000 USDS should give ~952.38 stUSDS at 1.05 rate
      const usdsInput = 1000n * RATE_PRECISION.WAD;
      const stUsdsOutput = (1000n * RATE_PRECISION.WAD * 100n) / 105n; // ~952.38

      const rate = calculateEffectiveRate(usdsInput, stUsdsOutput);

      // Rate should be approximately 0.952 * WAD
      const expectedRate = (100n * RATE_PRECISION.WAD) / 105n;
      expect(rate).toBe(expectedRate);
    });

    it('should handle sub-WAD precision amounts', () => {
      const input = 123456789n; // Less than 1 WAD
      const output = 123456789n;

      const rate = calculateEffectiveRate(input, output);

      expect(rate).toBe(RATE_PRECISION.WAD);
    });
  });

  describe('calculateRateDifferencePercent', () => {
    const WAD = RATE_PRECISION.WAD;

    it('should return 0 for equal rates', () => {
      const diff = calculateRateDifferencePercent(WAD, WAD);
      expect(diff).toBe(0);
    });

    it('should return positive percent when rateA > rateB', () => {
      const rateA = (101n * WAD) / 100n; // 1.01
      const rateB = WAD; // 1.00

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBe(1); // 1% difference
    });

    it('should return negative percent when rateA < rateB', () => {
      const rateA = (99n * WAD) / 100n; // 0.99
      const rateB = WAD; // 1.00

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBe(-1); // -1% difference
    });

    it('should handle small differences (basis points)', () => {
      const rateA = (10001n * WAD) / 10000n; // 1.0001 (1 bps higher)
      const rateB = WAD;

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBeCloseTo(0.01, 2); // 0.01% = 1 bps
    });

    it('should return 100 when rateB is zero and rateA is positive', () => {
      const diff = calculateRateDifferencePercent(WAD, 0n);
      expect(diff).toBe(100);
    });

    it('should return 0 when both rates are zero', () => {
      const diff = calculateRateDifferencePercent(0n, 0n);
      expect(diff).toBe(0);
    });

    it('should return -100 when rateA is zero and rateB is positive', () => {
      const diff = calculateRateDifferencePercent(0n, WAD);
      expect(diff).toBe(-100);
    });

    it('should handle very large rate differences (50%)', () => {
      const rateA = (150n * WAD) / 100n; // 1.50
      const rateB = WAD; // 1.00

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBe(50);
    });

    it('should handle rate doubling (100% increase)', () => {
      const rateA = 2n * WAD; // 2.00
      const rateB = WAD; // 1.00

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBe(100);
    });

    it('should handle rate halving (-50%)', () => {
      const rateA = WAD / 2n; // 0.50
      const rateB = WAD; // 1.00

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBe(-50);
    });

    it('should handle very small rates', () => {
      const rateA = 2n; // Very small
      const rateB = 1n; // Even smaller

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBe(100); // 100% increase
    });

    it('should handle realistic stUSDS rate difference (0.15%)', () => {
      const rateA = (10015n * WAD) / 10000n; // 1.0015 (Curve rate)
      const rateB = WAD; // 1.00 (native rate)

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBeCloseTo(0.15, 2);
    });

    it('should handle fractional basis point differences', () => {
      // Note: Due to bigint precision, differences smaller than 0.01% (1 bps) may round to 0
      // Testing 0.5 bps = 0.005% which is at the edge of precision
      const rateA = (10005n * WAD) / 10000n; // 1.0005 (5 bps = 0.05%)
      const rateB = WAD;

      const diff = calculateRateDifferencePercent(rateA, rateB);

      expect(diff).toBeCloseTo(0.05, 2);
    });
  });

  describe('isRateDifferenceSignificant', () => {
    it('should return false when difference is below threshold', () => {
      // 0.05% difference, 10 bps (0.1%) threshold
      expect(isRateDifferenceSignificant(0.05, 10)).toBe(false);
    });

    it('should return true when difference equals threshold', () => {
      // 0.1% difference, 10 bps (0.1%) threshold
      expect(isRateDifferenceSignificant(0.1, 10)).toBe(true);
    });

    it('should return true when difference exceeds threshold', () => {
      // 0.2% difference, 10 bps (0.1%) threshold
      expect(isRateDifferenceSignificant(0.2, 10)).toBe(true);
    });

    it('should work with negative differences (absolute value)', () => {
      // -0.2% difference, 10 bps threshold
      expect(isRateDifferenceSignificant(-0.2, 10)).toBe(true);
    });

    it('should return false for zero difference', () => {
      expect(isRateDifferenceSignificant(0, 10)).toBe(false);
    });

    it('should handle zero threshold', () => {
      // Any non-zero difference should be significant with 0 threshold
      expect(isRateDifferenceSignificant(0.001, 0)).toBe(true);
      expect(isRateDifferenceSignificant(0, 0)).toBe(true); // 0 >= 0
    });

    it('should handle very large thresholds', () => {
      // 100 bps = 1% threshold
      expect(isRateDifferenceSignificant(0.5, 100)).toBe(false);
      expect(isRateDifferenceSignificant(1.0, 100)).toBe(true);
      expect(isRateDifferenceSignificant(1.5, 100)).toBe(true);
    });

    it('should handle fractional thresholds', () => {
      // 5 bps = 0.05% threshold
      expect(isRateDifferenceSignificant(0.04, 5)).toBe(false);
      expect(isRateDifferenceSignificant(0.05, 5)).toBe(true);
      expect(isRateDifferenceSignificant(0.06, 5)).toBe(true);
    });

    it('should handle very large differences', () => {
      expect(isRateDifferenceSignificant(50, 10)).toBe(true);
      expect(isRateDifferenceSignificant(-50, 10)).toBe(true);
    });

    it('should return false for negative difference just below threshold', () => {
      // -0.09% difference, 10 bps (0.1%) threshold
      expect(isRateDifferenceSignificant(-0.09, 10)).toBe(false);
    });
  });

  describe('calculateMinOutputWithSlippage', () => {
    it('should reduce output by slippage percentage', () => {
      const output = 1000n * RATE_PRECISION.WAD;
      const slippageBps = 50; // 0.5%

      const minOutput = calculateMinOutputWithSlippage(output, slippageBps);

      // Expected: 1000 * (1 - 0.005) = 995
      expect(minOutput).toBe((9950n * RATE_PRECISION.WAD) / 10n);
    });

    it('should handle zero slippage', () => {
      const output = 1000n * RATE_PRECISION.WAD;

      const minOutput = calculateMinOutputWithSlippage(output, 0);

      expect(minOutput).toBe(output);
    });

    it('should handle 100% slippage (extreme case)', () => {
      const output = 1000n * RATE_PRECISION.WAD;

      const minOutput = calculateMinOutputWithSlippage(output, 10000);

      expect(minOutput).toBe(0n);
    });

    it('should handle small amounts', () => {
      const output = 100n; // Very small amount
      const slippageBps = 50;

      const minOutput = calculateMinOutputWithSlippage(output, slippageBps);

      // Should not underflow
      expect(minOutput).toBeLessThan(output);
      expect(minOutput).toBeGreaterThanOrEqual(0n);
    });

    it('should handle zero output amount', () => {
      const minOutput = calculateMinOutputWithSlippage(0n, 50);
      expect(minOutput).toBe(0n);
    });

    it('should handle very large output amounts', () => {
      const output = 10n ** 30n; // 1 trillion tokens with 18 decimals
      const slippageBps = 50;

      const minOutput = calculateMinOutputWithSlippage(output, slippageBps);

      // Should reduce by 0.5%
      expect(minOutput).toBe((output * 9950n) / 10000n);
    });

    it('should handle 50% slippage', () => {
      const output = 1000n * RATE_PRECISION.WAD;
      const slippageBps = 5000; // 50%

      const minOutput = calculateMinOutputWithSlippage(output, slippageBps);

      expect(minOutput).toBe(500n * RATE_PRECISION.WAD);
    });

    it('should handle 1 bps slippage', () => {
      const output = 10000n * RATE_PRECISION.WAD;
      const slippageBps = 1; // 0.01%

      const minOutput = calculateMinOutputWithSlippage(output, slippageBps);

      // 10000 * (1 - 0.0001) = 9999
      expect(minOutput).toBe(9999n * RATE_PRECISION.WAD);
    });

    it('should preserve precision for typical swap amounts', () => {
      // Realistic scenario: 1000 USDS swap with 0.5% slippage
      const output = 1000n * RATE_PRECISION.WAD;
      const slippageBps = 50;

      const minOutput = calculateMinOutputWithSlippage(output, slippageBps);

      // Should be exactly 995 * WAD
      expect(minOutput).toBe(995n * RATE_PRECISION.WAD);
    });
  });

  describe('compareRates', () => {
    const config = STUSDS_PROVIDER_CONFIG;
    const WAD = RATE_PRECISION.WAD;

    it('should return null provider when both quotes are invalid', () => {
      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, WAD, WAD, false);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, WAD, WAD, false);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBeNull();
      expect(result.differencePercent).toBe(0);
      expect(result.isSignificantDifference).toBe(false);
    });

    it('should return null provider when both quotes are undefined', () => {
      const result = compareRates(undefined, undefined, config);

      expect(result.betterProvider).toBeNull();
      expect(result.differencePercent).toBe(0);
      expect(result.isSignificantDifference).toBe(false);
    });

    it('should select Curve when native quote is invalid', () => {
      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, WAD, WAD, false);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, WAD, WAD, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.differencePercent).toBe(0);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should select native when Curve quote is invalid', () => {
      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, WAD, WAD, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, WAD, WAD, false);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.differencePercent).toBe(0);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should select Curve when native is undefined', () => {
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, WAD, WAD, true);

      const result = compareRates(undefined, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should select native when Curve is undefined', () => {
      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, WAD, WAD, true);

      const result = compareRates(nativeQuote, undefined, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should return null provider when rates are equal', () => {
      const amount = 1000n * WAD;
      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, amount, amount, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, amount, amount, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBeNull();
      expect(result.differencePercent).toBe(0);
      expect(result.isSignificantDifference).toBe(false);
    });

    it('should return null provider when difference is below threshold', () => {
      const input = 10000n * WAD;
      // Curve gives 0.05% better rate (below 0.1% threshold)
      const nativeOutput = 10000n * WAD;
      const curveOutput = 10005n * WAD;

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBeNull();
      expect(result.differencePercent).toBeCloseTo(0.05, 2);
      expect(result.isSignificantDifference).toBe(false);
    });

    it('should select Curve when Curve rate exceeds threshold', () => {
      const input = 10000n * WAD;
      // Curve gives 0.2% better rate (above 0.1% threshold)
      const nativeOutput = 10000n * WAD;
      const curveOutput = 10020n * WAD;

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.differencePercent).toBeCloseTo(0.2, 2);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should select native when native rate exceeds threshold', () => {
      const input = 10000n * WAD;
      // Native gives 0.2% better rate
      const nativeOutput = 10020n * WAD;
      const curveOutput = 10000n * WAD;

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.differencePercent).toBeCloseTo(-0.2, 1); // Use less strict precision
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should handle exactly at threshold (boundary condition)', () => {
      const input = 10000n * WAD;
      // Exactly 0.1% (10 bps) difference - should be significant
      const nativeOutput = 10000n * WAD;
      const curveOutput = 10010n * WAD;

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.differencePercent).toBeCloseTo(0.1, 2);
      expect(result.isSignificantDifference).toBe(true);
      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
    });

    it('should handle just below threshold', () => {
      const input = 100000n * WAD;
      // 0.09% difference (just below 0.1% threshold)
      const nativeOutput = 100000n * WAD;
      const curveOutput = 100090n * WAD;

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.differencePercent).toBeCloseTo(0.09, 2);
      expect(result.isSignificantDifference).toBe(false);
      expect(result.betterProvider).toBeNull();
    });

    it('should handle custom config with different threshold', () => {
      const customConfig = { ...config, rateSwitchThresholdBps: 50 }; // 0.5% threshold
      const input = 10000n * WAD;
      // 0.3% difference (below 0.5% threshold)
      const nativeOutput = 10000n * WAD;
      const curveOutput = 10030n * WAD;

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, customConfig);

      expect(result.differencePercent).toBeCloseTo(0.3, 2);
      expect(result.isSignificantDifference).toBe(false);
      expect(result.betterProvider).toBeNull();
    });

    it('should handle one quote valid with zero effective rate', () => {
      const input = 1000n * WAD;
      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, 0n, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, input, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should handle very large rate differences (10%)', () => {
      const input = 1000n * WAD;
      const nativeOutput = 1000n * WAD;
      const curveOutput = 1100n * WAD; // 10% better

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.differencePercent).toBe(10);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should handle native invalid with valid reason string', () => {
      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, WAD, WAD, false);
      nativeQuote.invalidReason = 'Supply cap reached';
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, WAD, WAD, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should handle both quotes with same input but different outputs', () => {
      const input = 1000n * WAD;
      // Realistic scenario: Curve slightly better due to liquidity
      const nativeOutput = 952380952380952380952n; // ~952.38 stUSDS (1.05 rate)
      const curveOutput = 954545454545454545454n; // ~954.55 stUSDS (slightly better)

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      // Curve is ~0.23% better
      expect(result.differencePercent).toBeCloseTo(0.23, 1);
      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.isSignificantDifference).toBe(true);
    });

    it('should handle mixed undefined and invalid quotes', () => {
      const invalidQuote = createMockQuote(StUsdsProviderType.NATIVE, WAD, WAD, false);

      // undefined native, invalid curve
      const result1 = compareRates(undefined, invalidQuote, config);
      expect(result1.betterProvider).toBeNull();

      // invalid native, undefined curve
      const result2 = compareRates(invalidQuote, undefined, config);
      expect(result2.betterProvider).toBeNull();
    });

    it('should handle zero input amounts', () => {
      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, 0n, 0n, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, 0n, 0n, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      // Both have 0 rate, should be equal
      expect(result.differencePercent).toBe(0);
      expect(result.betterProvider).toBeNull();
      expect(result.isSignificantDifference).toBe(false);
    });

    it('should handle config with zero threshold', () => {
      const zeroThresholdConfig = { ...config, rateSwitchThresholdBps: 0 };
      const input = 10000n * WAD;
      // Use a larger difference (0.1%) that won't be lost to precision
      const nativeOutput = 10000n * WAD;
      const curveOutput = 10010n * WAD; // 0.1% better

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, zeroThresholdConfig);

      expect(result.isSignificantDifference).toBe(true);
      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
    });

    it('should prefer native when curve is slightly worse', () => {
      const input = 10000n * WAD;
      // Native gives 0.2% better rate
      const nativeOutput = 10020n * WAD;
      const curveOutput = 10000n * WAD;

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, true);
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      expect(result.betterProvider).toBe(StUsdsProviderType.NATIVE);
      expect(result.differencePercent).toBeLessThan(0);
    });

    it('should calculate correct rate difference when native is blocked but has better rate', () => {
      const input = 10000n * WAD;
      // Native has ~4.76% better rate but is blocked
      // To get exactly -5% difference: (1.0 - 1.05) / 1.05 = -4.76%
      const nativeOutput = 10500n * WAD;
      const curveOutput = 10000n * WAD;

      const nativeQuote = createMockQuote(StUsdsProviderType.NATIVE, input, nativeOutput, false);
      nativeQuote.invalidReason = 'Native provider is blocked';
      const curveQuote = createMockQuote(StUsdsProviderType.CURVE, input, curveOutput, true);

      const result = compareRates(nativeQuote, curveQuote, config);

      // Should select Curve since native is blocked, but still show the rate difference
      expect(result.betterProvider).toBe(StUsdsProviderType.CURVE);
      expect(result.differencePercent).toBeCloseTo(-4.76, 2); // Negative because native would be better
      expect(result.isSignificantDifference).toBe(true); // Always significant when one is invalid
    });
  });
});
