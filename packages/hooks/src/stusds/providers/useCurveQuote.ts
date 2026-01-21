import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { useReadCurveStUsdsUsdsPoolGetDy, useReadCurveStUsdsUsdsPoolGetDx } from '../../generated';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { TENDERLY_CHAIN_ID } from '../../constants';
import { useCurvePoolData } from './useCurvePoolData';
import { RATE_PRECISION } from './constants';
import { StUsdsDirection } from './types';

/**
 * Parameters for the Curve quote hook.
 */
export type CurveQuoteParams = {
  /** Direction of the swap - determines how amount is interpreted */
  direction: StUsdsDirection;
  /**
   * Amount in USDS terms:
   * - For deposits: USDS input amount
   * - For withdrawals: USDS output amount (desired)
   */
  amount: bigint;
  /** Whether the quote should be fetched */
  enabled?: boolean;
  /** For max withdrawals, the user's stUSDS balance to exchange directly */
  userStUsdsBalance?: bigint;
  /** Whether this is a max withdrawal (affects how stUSDS amount is calculated) */
  isMax?: boolean;
  /** Reference rate for price impact calculation (USDS per stUSDS, scaled by 1e18) */
  referenceRate?: bigint;
};

/**
 * Quote result from Curve pool.
 * All amounts are in their respective token units.
 */
export type CurveQuoteData = {
  /** stUSDS amount (output for deposits, input for withdrawals) */
  stUsdsAmount: bigint;
  /** USDS amount (input for deposits, output for withdrawals) */
  usdsAmount: bigint;
  /** Price impact in basis points (approximate) */
  priceImpactBps: number;
  /** Effective rate scaled by 1e18 */
  effectiveRate: bigint;
};

/**
 * Return type for useCurveQuote hook.
 */
export type CurveQuoteHookResult = {
  data: CurveQuoteData | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Hook to get a quote from the Curve USDS/stUSDS pool.
 *
 * For deposits (USDS → stUSDS):
 *   Uses get_dy to calculate stUSDS output from USDS input.
 *
 * For withdrawals (stUSDS → USDS):
 *   - Normal case: Uses get_dx to calculate stUSDS input needed for desired USDS output.
 *   - Max case: Uses get_dy with user's full stUSDS balance to get USDS output.
 *
 * @param params - Quote parameters
 * @returns Quote data including amounts and price impact
 */
export function useCurveQuote(params: CurveQuoteParams): CurveQuoteHookResult {
  const { direction, amount, enabled = true, userStUsdsBalance, isMax = false, referenceRate } = params;

  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? TENDERLY_CHAIN_ID : 1;

  // Get pool data to determine token indices
  const { data: poolData, isLoading: isPoolLoading, error: poolError } = useCurvePoolData();

  const usdsIndex = poolData?.tokenIndices.usds ?? 0;
  const stUsdsIndex = poolData?.tokenIndices.stUsds ?? 1;

  // For deposits: get_dy(usds_idx, stusds_idx, usds_amount) → stusds output
  const {
    data: depositOutput,
    isLoading: isDepositLoading,
    error: depositError,
    refetch: refetchDeposit
  } = useReadCurveStUsdsUsdsPoolGetDy({
    args: [BigInt(usdsIndex), BigInt(stUsdsIndex), amount],
    chainId,
    query: {
      enabled: enabled && direction === StUsdsDirection.SUPPLY && amount > 0n && !!poolData,
      refetchInterval: 15000 // Refetch every 15 seconds
    }
  });

  // For withdrawals: get_dx(stusds_idx, usds_idx, usds_amount) → stusds input needed
  // Only used for normal (non-max) withdrawals
  const {
    data: withdrawInput,
    isLoading: isWithdrawLoading,
    error: withdrawError,
    refetch: refetchWithdraw
  } = useReadCurveStUsdsUsdsPoolGetDx({
    args: [BigInt(stUsdsIndex), BigInt(usdsIndex), amount],
    chainId,
    query: {
      enabled: enabled && direction === StUsdsDirection.WITHDRAW && amount > 0n && !!poolData && !isMax,
      refetchInterval: 15000 // Refetch every 15 seconds
    }
  });

  // For max withdrawals: get_dy(stusds_idx, usds_idx, userStUsdsBalance) → usds output
  const {
    data: maxWithdrawOutput,
    isLoading: isMaxWithdrawLoading,
    error: maxWithdrawError,
    refetch: refetchMaxWithdraw
  } = useReadCurveStUsdsUsdsPoolGetDy({
    args: [BigInt(stUsdsIndex), BigInt(usdsIndex), userStUsdsBalance ?? 0n],
    chainId,
    query: {
      enabled:
        enabled &&
        direction === StUsdsDirection.WITHDRAW &&
        isMax &&
        (userStUsdsBalance ?? 0n) > 0n &&
        !!poolData,
      refetchInterval: 15000 // Refetch every 15 seconds
    }
  });

  const data: CurveQuoteData | undefined = useMemo(() => {
    if (direction === StUsdsDirection.SUPPLY) {
      if (!depositOutput || amount === 0n) return undefined;

      // For deposits: USDS in, stUSDS out
      const usdsAmount = amount;
      const stUsdsAmount = depositOutput;

      // Rate: stUSDS per USDS (how much stUSDS you get per USDS)
      const effectiveRate = (stUsdsAmount * RATE_PRECISION.WAD) / usdsAmount;

      // Price impact: referenceRate is "USDS per stUSDS", effectiveRate is "stUSDS per USDS",
      // so we invert the reference rate to compare in the same units.
      let priceImpactBps = 0;
      if (referenceRate && referenceRate > 0n) {
        const expectedRate = (RATE_PRECISION.WAD * RATE_PRECISION.WAD) / referenceRate;
        if (effectiveRate < expectedRate) {
          const impact = ((expectedRate - effectiveRate) * RATE_PRECISION.BPS_DIVISOR) / expectedRate;
          priceImpactBps = Number(impact);
        }
      }

      return {
        stUsdsAmount,
        usdsAmount,
        priceImpactBps,
        effectiveRate
      };
    } else {
      // direction === StUsdsDirection.WITHDRAW

      if (isMax) {
        // Max withdrawal: use user's full stUSDS balance directly
        if (!maxWithdrawOutput || !userStUsdsBalance || userStUsdsBalance === 0n) return undefined;

        const stUsdsAmount = userStUsdsBalance;
        const usdsAmount = maxWithdrawOutput;

        // Rate: USDS per stUSDS (how much USDS you get per stUSDS burned)
        const effectiveRate = (usdsAmount * RATE_PRECISION.WAD) / stUsdsAmount;

        // Price impact: both rates are "USDS per stUSDS", so compare directly (no inversion).
        let priceImpactBps = 0;
        if (referenceRate && referenceRate > 0n) {
          if (effectiveRate < referenceRate) {
            const impact = ((referenceRate - effectiveRate) * RATE_PRECISION.BPS_DIVISOR) / referenceRate;
            priceImpactBps = Number(impact);
          }
        }

        return {
          stUsdsAmount,
          usdsAmount,
          priceImpactBps,
          effectiveRate
        };
      } else {
        // Normal withdrawal: calculate stUSDS needed for desired USDS
        if (!withdrawInput || amount === 0n) return undefined;

        const usdsAmount = amount;
        const stUsdsAmount = withdrawInput;

        // Rate: USDS per stUSDS (how much USDS you get per stUSDS burned)
        const effectiveRate = (usdsAmount * RATE_PRECISION.WAD) / stUsdsAmount;

        // Price impact: both rates are "USDS per stUSDS", so compare directly (no inversion).
        let priceImpactBps = 0;
        if (referenceRate && referenceRate > 0n) {
          if (effectiveRate < referenceRate) {
            const impact = ((referenceRate - effectiveRate) * RATE_PRECISION.BPS_DIVISOR) / referenceRate;
            priceImpactBps = Number(impact);
          }
        }

        return {
          stUsdsAmount,
          usdsAmount,
          priceImpactBps,
          effectiveRate
        };
      }
    }
  }, [
    direction,
    amount,
    depositOutput,
    withdrawInput,
    maxWithdrawOutput,
    userStUsdsBalance,
    isMax,
    referenceRate
  ]);

  const isLoading =
    isPoolLoading ||
    (direction === StUsdsDirection.SUPPLY
      ? isDepositLoading
      : isMax
        ? isMaxWithdrawLoading
        : isWithdrawLoading);

  const error =
    poolError ||
    (direction === StUsdsDirection.SUPPLY ? depositError : isMax ? maxWithdrawError : withdrawError);

  const refetch = () => {
    if (direction === StUsdsDirection.SUPPLY) {
      refetchDeposit();
    } else if (isMax) {
      refetchMaxWithdraw();
    } else {
      refetchWithdraw();
    }
  };

  return {
    data,
    isLoading,
    error: error as Error | null,
    refetch
  };
}

// Legacy type exports for backwards compatibility with existing code
export type { CurveQuoteParams as LegacyCurveQuoteParams };
