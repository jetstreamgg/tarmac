import { useMemo } from 'react';
import { useCurvePoolData } from './useCurvePoolData';
import { useCurveQuote } from './useCurveQuote';
import { useCurveRate } from './useCurveRate';
import { STUSDS_PROVIDER_CONFIG } from './constants';
import {
  StUsdsProviderType,
  StUsdsProviderStatus,
  StUsdsProviderData,
  StUsdsProviderState,
  StUsdsQuote,
  StUsdsQuoteParams,
  StUsdsProviderHookResult,
  StUsdsRateInfo,
  StUsdsBlockedReason,
  StUsdsDirection
} from './types';

/**
 * Minimum liquidity threshold to consider the pool available.
 * Prevents issues with very small pool balances.
 */
const MIN_LIQUIDITY_THRESHOLD = 10n ** 16n; // 0.01 tokens

/**
 * Hook that provides Curve pool integration in the provider abstraction format.
 * Enables swapping USDS <-> stUSDS via the Curve pool as an alternative to native contract.
 *
 * @param params - Quote parameters (amount and direction)
 * @returns Provider data in the standard format
 */
export function useCurveStUsdsProvider(
  params: StUsdsQuoteParams & {
    userStUsdsBalance?: bigint;
    isMax?: boolean;
  }
): StUsdsProviderHookResult {
  const { amount, direction, userStUsdsBalance, isMax } = params;

  // Get Curve pool data
  const {
    data: poolData,
    isLoading: isPoolLoading,
    error: poolError,
    refetch: refetchPool
  } = useCurvePoolData();

  // Get reference rate for price impact calculation
  const { curveRate, isLoading: isRateLoading } = useCurveRate();

  // Get quote from Curve pool
  // The quote hook now uses direction to determine the correct calculation:
  // - For deposits: amount is USDS input, returns stUSDS output
  // - For withdrawals: amount is desired USDS output, returns required stUSDS input
  // - For max withdrawals: uses userStUsdsBalance directly, skips get_dx
  const {
    data: quoteData,
    isLoading: isQuoteLoading,
    error: quoteError,
    refetch: refetchQuote
  } = useCurveQuote({
    direction,
    amount,
    userStUsdsBalance,
    isMax,
    referenceRate: curveRate,
    enabled: (amount > 0n || (isMax && (userStUsdsBalance ?? 0n) > 0n)) && !!poolData
  });

  // Determine provider state based on pool liquidity
  const state: StUsdsProviderState | undefined = useMemo(() => {
    if (!poolData) return undefined;

    // Check if there's sufficient liquidity for deposits (need stUSDS in pool)
    // When depositing USDS, we get stUSDS out, so we need stUSDS liquidity
    const canDeposit = poolData.stUsdsReserve > MIN_LIQUIDITY_THRESHOLD;

    // Check if there's sufficient liquidity for withdrawals (need USDS in pool)
    // When withdrawing, we swap stUSDS for USDS, so we need USDS liquidity
    const canWithdraw = poolData.usdsReserve > MIN_LIQUIDITY_THRESHOLD;

    // Determine overall status based on requested direction
    let status: StUsdsProviderStatus;
    if (direction === StUsdsDirection.SUPPLY) {
      status = canDeposit ? StUsdsProviderStatus.AVAILABLE : StUsdsProviderStatus.BLOCKED;
    } else {
      status = canWithdraw ? StUsdsProviderStatus.AVAILABLE : StUsdsProviderStatus.BLOCKED;
    }

    let blockedReason: StUsdsBlockedReason | undefined;
    if (status === StUsdsProviderStatus.BLOCKED) {
      if (direction === StUsdsDirection.SUPPLY) {
        blockedReason = StUsdsBlockedReason.CURVE_INSUFFICIENT_STUSDS_LIQUIDITY;
      } else {
        blockedReason = StUsdsBlockedReason.CURVE_INSUFFICIENT_USDS_LIQUIDITY;
      }
    }

    return {
      providerType: StUsdsProviderType.CURVE,
      status,
      canDeposit,
      canWithdraw,
      blockedReason
    };
  }, [poolData, direction]);

  // Build quote if amount > 0 or it's a max withdrawal
  // Note: Max withdrawals start with amount=0 since output is calculated from balance
  const quote: StUsdsQuote | undefined = useMemo(() => {
    if (!state || (amount === 0n && !isMax)) return undefined;

    if (!quoteData || quoteData.stUsdsAmount === 0n) {
      // If still loading, return undefined (pending state)
      if (isQuoteLoading) return undefined;
      // If done loading and no data, return invalid quote
      return {
        providerType: StUsdsProviderType.CURVE,
        inputAmount: direction === StUsdsDirection.SUPPLY ? amount : 0n,
        outputAmount: direction === StUsdsDirection.SUPPLY ? 0n : amount,
        // For transactions: stUsdsAmount is what goes into/out of Curve for stUSDS side
        stUsdsAmount: 0n,
        rateInfo: {
          outputAmount: 0n,
          effectiveRate: 0n,
          feeAmount: 0n,
          estimatedSlippageBps: 0,
          priceImpactBps: 0
        },
        isValid: false,
        invalidReason: 'Unable to get Curve quote'
      };
    }

    // Check if the operation is valid
    let isValid = true;
    let invalidReason: string | undefined;

    if (direction === StUsdsDirection.SUPPLY) {
      if (!state.canDeposit) {
        isValid = false;
        invalidReason = 'Curve pool deposits unavailable';
      }
    } else {
      if (!state.canWithdraw) {
        isValid = false;
        invalidReason = 'Curve pool withdrawals unavailable';
      }
    }

    // Check for excessive price impact
    // Note: Price impact threshold is separate from slippage tolerance.
    // Price impact measures how the trade affects pool price (size-dependent),
    // while slippage is the acceptable deviation during execution (time-dependent).
    if (quoteData.priceImpactBps > STUSDS_PROVIDER_CONFIG.maxPriceImpactBps) {
      isValid = false;
      invalidReason = 'Price impact too high';
    }

    // Determine input/output amounts based on direction
    // For deposits: input = USDS, output = stUSDS
    // For withdrawals: input = stUSDS, output = USDS
    const inputAmount = direction === StUsdsDirection.SUPPLY ? quoteData.usdsAmount : quoteData.stUsdsAmount;
    const outputAmount = direction === StUsdsDirection.SUPPLY ? quoteData.stUsdsAmount : quoteData.usdsAmount;

    // Curve fees are already included in the quote
    const rateInfo: StUsdsRateInfo = {
      outputAmount,
      effectiveRate: quoteData.effectiveRate,
      feeAmount: 0n, // Fees included in quote
      estimatedSlippageBps: STUSDS_PROVIDER_CONFIG.maxSlippageBps,
      priceImpactBps: quoteData.priceImpactBps
    };

    return {
      providerType: StUsdsProviderType.CURVE,
      inputAmount,
      outputAmount,
      // Include stUsdsAmount for transaction execution
      // For deposits: this is the stUSDS output (what user receives)
      // For withdrawals: this is the stUSDS input (what user spends)
      stUsdsAmount: quoteData.stUsdsAmount,
      rateInfo,
      isValid,
      invalidReason
    };
  }, [state, amount, direction, quoteData, isMax, isQuoteLoading]);

  // Combine into provider data
  const data: StUsdsProviderData | undefined = useMemo(() => {
    if (!state) return undefined;

    return {
      providerType: StUsdsProviderType.CURVE,
      state,
      quote
    };
  }, [state, quote]);

  const isLoading = isPoolLoading || isQuoteLoading || isRateLoading;
  const error = poolError || quoteError;

  const refetch = () => {
    refetchPool();
    refetchQuote();
  };

  return {
    data,
    isLoading,
    error: error as Error | null,
    refetch
  };
}
