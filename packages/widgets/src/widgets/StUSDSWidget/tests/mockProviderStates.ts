/**
 * Mock states for testing stUSDS provider selection UI.
 * These mocks simulate different scenarios like supply cap reached,
 * liquidity exhausted, Curve having better rates, etc.
 */

import {
  StUsdsProviderType,
  StUsdsProviderStatus,
  StUsdsSelectionReason,
  StUsdsProviderSelectionResult,
  StUsdsProviderData
} from '@jetstreamgg/sky-hooks';

// Helper to create a native provider state
const createNativeProvider = (overrides: {
  canDeposit?: boolean;
  canWithdraw?: boolean;
  maxDeposit?: bigint;
  maxWithdraw?: bigint;
}): StUsdsProviderData => ({
  providerType: StUsdsProviderType.NATIVE,
  state: {
    providerType: StUsdsProviderType.NATIVE,
    status:
      overrides.canDeposit === false || overrides.canWithdraw === false
        ? StUsdsProviderStatus.BLOCKED
        : StUsdsProviderStatus.AVAILABLE,
    canDeposit: overrides.canDeposit ?? true,
    canWithdraw: overrides.canWithdraw ?? true,
    maxDeposit: overrides.maxDeposit ?? 1000000000000000000000n, // 1000 USDS
    maxWithdraw: overrides.maxWithdraw ?? 1000000000000000000000n
  },
  quote: undefined
});

// Helper to create a Curve provider state
const createCurveProvider = (overrides: {
  canDeposit?: boolean;
  canWithdraw?: boolean;
}): StUsdsProviderData => ({
  providerType: StUsdsProviderType.CURVE,
  state: {
    providerType: StUsdsProviderType.CURVE,
    status:
      overrides.canDeposit === false || overrides.canWithdraw === false
        ? StUsdsProviderStatus.BLOCKED
        : StUsdsProviderStatus.AVAILABLE,
    canDeposit: overrides.canDeposit ?? true,
    canWithdraw: overrides.canWithdraw ?? true
  },
  quote: undefined
});

/**
 * Mock provider selection states for different test scenarios.
 */
export const mockProviderStates = {
  /**
   * Both providers available, using native (default behavior)
   */
  bothAvailable_usingNative: (): StUsdsProviderSelectionResult => ({
    selectedProvider: StUsdsProviderType.NATIVE,
    selectionReason: StUsdsSelectionReason.NATIVE_DEFAULT,
    selectedQuote: undefined,
    nativeProvider: createNativeProvider({}),
    curveProvider: createCurveProvider({}),
    allProvidersBlocked: false,
    rateDifferencePercent: 0,
    isSelectionLoading: false,
    isLoading: false,
    error: null,
    refetch: () => {}
  }),

  /**
   * Native blocked due to supply cap reached, using Curve
   */
  nativeBlocked_supplyCapReached: (): StUsdsProviderSelectionResult => ({
    selectedProvider: StUsdsProviderType.CURVE,
    selectionReason: StUsdsSelectionReason.CURVE_ONLY_AVAILABLE,
    selectedQuote: undefined,
    nativeProvider: createNativeProvider({
      canDeposit: false,
      maxDeposit: 0n
    }),
    curveProvider: createCurveProvider({}),
    allProvidersBlocked: false,
    rateDifferencePercent: 0,
    isSelectionLoading: false,
    isLoading: false,
    error: null,
    refetch: () => {}
  }),

  /**
   * Native blocked due to liquidity exhausted (100% utilization), using Curve
   */
  nativeBlocked_liquidityExhausted: (): StUsdsProviderSelectionResult => ({
    selectedProvider: StUsdsProviderType.CURVE,
    selectionReason: StUsdsSelectionReason.CURVE_ONLY_AVAILABLE,
    selectedQuote: undefined,
    nativeProvider: createNativeProvider({
      canWithdraw: false,
      maxWithdraw: 0n
    }),
    curveProvider: createCurveProvider({}),
    allProvidersBlocked: false,
    rateDifferencePercent: 0,
    isSelectionLoading: false,
    isLoading: false,
    error: null,
    refetch: () => {}
  }),

  /**
   * Curve has better rate (above threshold), automatically selected
   */
  curveSelected_betterRate: (): StUsdsProviderSelectionResult => ({
    selectedProvider: StUsdsProviderType.CURVE,
    selectionReason: StUsdsSelectionReason.CURVE_BETTER_RATE,
    selectedQuote: undefined,
    nativeProvider: createNativeProvider({}),
    curveProvider: createCurveProvider({}),
    allProvidersBlocked: false,
    rateDifferencePercent: 0.25, // 0.25% better rate
    isSelectionLoading: false,
    isLoading: false,
    error: null,
    refetch: () => {}
  }),

  /**
   * Both providers blocked - deposits unavailable
   */
  bothBlocked_deposits: (): StUsdsProviderSelectionResult => ({
    selectedProvider: StUsdsProviderType.NATIVE,
    selectionReason: StUsdsSelectionReason.ALL_BLOCKED,
    selectedQuote: undefined,
    nativeProvider: createNativeProvider({
      canDeposit: false,
      maxDeposit: 0n
    }),
    curveProvider: createCurveProvider({
      canDeposit: false
    }),
    allProvidersBlocked: true,
    rateDifferencePercent: 0,
    isSelectionLoading: false,
    isLoading: false,
    error: null,
    refetch: () => {}
  }),

  /**
   * Both providers blocked - withdrawals unavailable
   */
  bothBlocked_withdrawals: (): StUsdsProviderSelectionResult => ({
    selectedProvider: StUsdsProviderType.NATIVE,
    selectionReason: StUsdsSelectionReason.ALL_BLOCKED,
    selectedQuote: undefined,
    nativeProvider: createNativeProvider({
      canWithdraw: false,
      maxWithdraw: 0n
    }),
    curveProvider: createCurveProvider({
      canWithdraw: false
    }),
    allProvidersBlocked: true,
    rateDifferencePercent: 0,
    isSelectionLoading: false,
    isLoading: false,
    error: null,
    refetch: () => {}
  }),

  /**
   * Provider selection is loading
   */
  loading: (): StUsdsProviderSelectionResult => ({
    selectedProvider: StUsdsProviderType.NATIVE,
    selectionReason: StUsdsSelectionReason.NATIVE_DEFAULT,
    selectedQuote: undefined,
    nativeProvider: undefined,
    curveProvider: undefined,
    allProvidersBlocked: false,
    rateDifferencePercent: 0,
    isSelectionLoading: true,
    isLoading: true,
    error: null,
    refetch: () => {}
  })
};

/**
 * Mock stUSDS data for different scenarios
 */
export const mockStUsdsData = {
  /**
   * Normal state with liquidity available
   */
  normal: {
    totalAssets: 10000000000000000000000n, // 10,000 USDS
    totalSupply: 9500000000000000000000n,
    availableLiquidityBuffered: 5000000000000000000000n, // 5,000 USDS available
    userUsdsBalance: 100000000000000000000n, // 100 USDS in wallet
    userSuppliedUsds: 50000000000000000000n, // 50 USDS supplied
    userStUsdsBalance: 48000000000000000000n,
    userMaxWithdrawBuffered: 50000000000000000000n,
    moduleRate: 850000000000000000n // 8.5% APY
  },

  /**
   * 100% utilization - no liquidity available
   */
  fullUtilization: {
    totalAssets: 10000000000000000000000n,
    totalSupply: 10000000000000000000000n,
    availableLiquidityBuffered: 0n, // No liquidity
    userUsdsBalance: 100000000000000000000n,
    userSuppliedUsds: 50000000000000000000n,
    userStUsdsBalance: 48000000000000000000n,
    userMaxWithdrawBuffered: 0n, // Can't withdraw
    moduleRate: 850000000000000000n
  },

  /**
   * No user balance
   */
  noBalance: {
    totalAssets: 10000000000000000000000n,
    totalSupply: 9500000000000000000000n,
    availableLiquidityBuffered: 5000000000000000000000n,
    userUsdsBalance: 0n,
    userSuppliedUsds: 0n,
    userStUsdsBalance: 0n,
    userMaxWithdrawBuffered: 0n,
    moduleRate: 850000000000000000n
  }
};

/**
 * Mock capacity data for different scenarios
 */
export const mockCapacityData = {
  /**
   * Normal capacity available
   */
  normal: {
    remainingCapacityBuffered: 1000000000000000000000n, // 1,000 USDS remaining
    totalCapacity: 10000000000000000000000n,
    usedCapacity: 9000000000000000000000n
  },

  /**
   * Supply cap reached
   */
  capReached: {
    remainingCapacityBuffered: 0n, // No capacity
    totalCapacity: 10000000000000000000000n,
    usedCapacity: 10000000000000000000000n
  },

  /**
   * Low capacity warning
   */
  lowCapacity: {
    remainingCapacityBuffered: 100000000000000000000n, // Only 100 USDS remaining
    totalCapacity: 10000000000000000000000n,
    usedCapacity: 9900000000000000000000n
  }
};

/**
 * Type for the useStUsdsProviderSelection hook mock
 */
export type MockProviderSelectionHook = () => StUsdsProviderSelectionResult;

/**
 * Creates a mock function for useStUsdsProviderSelection
 */
export const createProviderSelectionMock = (
  state: StUsdsProviderSelectionResult
): MockProviderSelectionHook => {
  return () => state;
};
