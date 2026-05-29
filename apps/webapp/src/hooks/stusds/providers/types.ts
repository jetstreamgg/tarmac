/**
 * Provider abstraction types for stUSDS liquidity providers.
 * Supports automatic routing between native stUSDS contract and 3rd party pools (e.g., Curve).
 */

/**
 * Available liquidity provider types for stUSDS operations.
 */
export enum StUsdsProviderType {
  /** Native stUSDS contract (direct deposit/withdraw) */
  NATIVE = 'native',
  /** Curve LP pool (swap USDS <-> stUSDS) */
  CURVE = 'curve'
}

/**
 * Status of a liquidity provider's availability.
 */
export enum StUsdsProviderStatus {
  /** Provider is available for operations */
  AVAILABLE = 'available',
  /** Provider is blocked (e.g., capacity reached, liquidity exhausted) */
  BLOCKED = 'blocked',
  /** Provider is available but has inferior rate compared to another provider */
  RATE_INFERIOR = 'rate_inferior'
}

/**
 * Reason for selecting a particular provider.
 */
export enum StUsdsSelectionReason {
  /** Native is the only available provider */
  NATIVE_ONLY_AVAILABLE = 'native_only_available',
  /** Curve is the only available provider (native blocked) */
  CURVE_ONLY_AVAILABLE = 'curve_only_available',
  /** Native selected because it has a better rate */
  NATIVE_BETTER_RATE = 'native_better_rate',
  /** Curve selected because it has a better rate */
  CURVE_BETTER_RATE = 'curve_better_rate',
  /** Native selected as default (rates similar, prefer native) */
  NATIVE_DEFAULT = 'native_default',
  /** Both providers are blocked */
  ALL_BLOCKED = 'all_blocked'
}

/**
 * Reason why a provider is blocked.
 */
export enum StUsdsBlockedReason {
  /** Native: Supply capacity has been reached */
  SUPPLY_CAPACITY_REACHED = 'supply_capacity_reached',
  AMOUNT_EXCEEDS_SUPPLY_CAPACITY = 'amount_exceeds_supply_capacity',
  /** Native: Available liquidity exhausted */
  LIQUIDITY_EXHAUSTED = 'liquidity_exhausted',
  AMOUNT_EXCEEDS_LIQUIDITY = 'amount_exceeds_liquidity',
  /** Curve: Insufficient stUSDS liquidity for deposits */
  CURVE_INSUFFICIENT_STUSDS_LIQUIDITY = 'curve_insufficient_stusds_liquidity',
  /** Curve: Insufficient USDS liquidity for withdrawals */
  CURVE_INSUFFICIENT_USDS_LIQUIDITY = 'curve_insufficient_usds_liquidity'
}

/**
 * Direction of the stUSDS operation.
 */
export enum StUsdsDirection {
  SUPPLY = 'supply',
  WITHDRAW = 'withdraw'
}

/**
 * Rate information for a quote, including fees and slippage estimates.
 */
export type StUsdsRateInfo = {
  /** Amount of output tokens for the given input */
  outputAmount: bigint;
  /** Effective rate (output/input) scaled by 1e18 */
  effectiveRate: bigint;
  /** Fee amount in output tokens (0 for native, included in Curve quote) */
  feeAmount: bigint;
  /** Estimated slippage in basis points */
  estimatedSlippageBps: number;
  /** Price impact in basis points */
  priceImpactBps: number;
};

/**
 * Current state of a liquidity provider.
 */
export type StUsdsProviderState = {
  /** Which provider this state represents */
  providerType: StUsdsProviderType;
  /** Current availability status */
  status: StUsdsProviderStatus;
  /** Whether deposits (USDS -> stUSDS) are currently available */
  canDeposit: boolean;
  /** Whether withdrawals (stUSDS -> USDS) are currently available */
  canWithdraw: boolean;
  /** Maximum deposit amount (only provided by native provider) */
  maxDeposit?: bigint;
  /** Maximum withdrawal amount (only provided by native provider) */
  maxWithdraw?: bigint;
  /** Structured reason if provider is blocked */
  blockedReason?: StUsdsBlockedReason;
};

/**
 * Parameters for requesting a quote from a provider.
 */
export type StUsdsQuoteParams = {
  /** Amount to deposit or withdraw (in source token) */
  amount: bigint;
  /** Direction of the operation */
  direction: StUsdsDirection;
};

/**
 * Quote from a liquidity provider for a specific operation.
 */
export type StUsdsQuote = {
  /** Which provider generated this quote */
  providerType: StUsdsProviderType;
  /** Input amount (USDS for deposit, stUSDS for withdraw) */
  inputAmount: bigint;
  /** Expected output amount (stUSDS for deposit, USDS for withdraw) */
  outputAmount: bigint;
  /**
   * stUSDS amount for Curve transactions (optional, only set by Curve provider).
   * - For deposits: this is the stUSDS output (same as outputAmount)
   * - For withdrawals: this is the stUSDS input needed to receive the desired USDS
   * Used by useBatchCurveSwap to construct the swap call with correct amounts.
   */
  stUsdsAmount?: bigint;
  /** Detailed rate information */
  rateInfo: StUsdsRateInfo;
  /** Whether this quote is executable */
  isValid: boolean;
  /** Reason if quote is not valid */
  invalidReason?: string;
};

/**
 * Combined provider data (state + optional quote).
 */
export type StUsdsProviderData = {
  /** Which provider this data represents */
  providerType: StUsdsProviderType;
  /** Current provider state */
  state: StUsdsProviderState;
  /** Quote for the requested operation (if amount > 0) */
  quote?: StUsdsQuote;
};

/**
 * Return type for individual provider hooks.
 */
export type StUsdsProviderHookResult = {
  /** Provider data (state and quote) */
  data: StUsdsProviderData | undefined;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Error if data fetch failed */
  error: Error | null;
  /** Function to manually refetch data */
  refetch: () => void;
};

/**
 * Result from the provider selection hook.
 */
export type StUsdsProviderSelectionResult = {
  /** The recommended provider to use */
  selectedProvider: StUsdsProviderType;
  /** Why this provider was selected */
  selectionReason: StUsdsSelectionReason;
  /** Quote from the selected provider (convenience accessor) */
  selectedQuote: StUsdsQuote | undefined;
  /** Data from native provider */
  nativeProvider: StUsdsProviderData | undefined;
  /** Data from Curve provider */
  curveProvider: StUsdsProviderData | undefined;
  /** True if both providers are blocked for the requested operation */
  allProvidersBlocked: boolean;
  /** Rate difference between providers (positive = Curve better, negative = Native better) */
  rateDifferencePercent: number;
  /** Whether selection data is loading (stable, doesn't change during typing) */
  isSelectionLoading: boolean;
  /** Whether any data is currently loading (selection or quotes) */
  isLoading: boolean;
  /** Error if selection failed */
  error: Error | null;
  /** Function to manually refetch data */
  refetch: () => void;
};

/**
 * Configuration for rate comparison logic.
 */
export type StUsdsRateComparisonConfig = {
  /**
   * Minimum rate advantage (basis points) required to prefer Curve over native.
   * Native is the default; Curve must exceed this threshold to be selected.
   */
  rateSwitchThresholdBps: number;
  /**
   * Maximum acceptable slippage for swaps (basis points).
   * Slippage = deviation from quoted price during execution due to price movement.
   */
  maxSlippageBps: number;
  /**
   * Maximum acceptable price impact for swaps (basis points).
   * Price impact = how much the trade size affects the pool price.
   * Typically higher than slippage as larger trades naturally have more impact.
   */
  maxPriceImpactBps: number;
};
