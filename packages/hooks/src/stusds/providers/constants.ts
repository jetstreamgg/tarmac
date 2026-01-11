import type { StUsdsRateComparisonConfig } from './types';

/**
 * Configuration for provider selection and rate comparison.
 */
export const STUSDS_PROVIDER_CONFIG: StUsdsRateComparisonConfig = {
  /**
   * Minimum rate advantage (basis points) required to prefer Curve over native.
   * Native is the default provider; Curve is only selected if it offers at least
   * this much better rate.
   */
  rateSwitchThresholdBps: 10, // 0.1%

  /**
   * Maximum acceptable slippage for Curve swaps (basis points).
   * Slippage represents the acceptable deviation from the quoted price during execution
   * due to price movement between quote and transaction confirmation.
   */
  maxSlippageBps: 50, // 0.5%

  /**
   * Maximum acceptable price impact for Curve swaps (basis points).
   * Price impact represents how much the trade size affects the pool price.
   * This is higher than slippage tolerance because larger trades naturally have
   * more price impact, especially in smaller pools. A 1-2% price impact may be
   * acceptable for large trades while 0.5% slippage tolerance is standard.
   */
  maxPriceImpactBps: 200 // 2%
} as const;

/**
 * Token indices in the Curve USDS/stUSDS pool.
 * These need to be verified by calling coins(0) and coins(1) on the pool contract.
 * TODO: Verify these indices match the actual pool configuration.
 */
export const CURVE_POOL_TOKEN_INDICES = {
  /** Index of USDS token in the Curve pool */
  USDS: 0,
  /** Index of stUSDS token in the Curve pool */
  STUSDS: 1
} as const;

/**
 * Precision constants for rate calculations.
 */
export const RATE_PRECISION = {
  /** Standard ERC20/DeFi precision (1e18) */
  WAD: 10n ** 18n,
  /** Basis points divisor */
  BPS_DIVISOR: 10000n
} as const;
