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
 *   Uses get_dx to calculate stUSDS input needed for desired USDS output.
 *   This matches the native stUSDS interface where users specify USDS amounts.
 *
 * @param params - Quote parameters
 * @returns Quote data including amounts and price impact
 */
export function useCurveQuote(params: CurveQuoteParams): CurveQuoteHookResult {
  const { direction, amount, enabled = true } = params;

  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? TENDERLY_CHAIN_ID : 1;

  // Get pool data to determine token indices
  const { data: poolData, isLoading: isPoolLoading } = useCurvePoolData();

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
      enabled: enabled && direction === StUsdsDirection.SUPPLY && amount > 0n && !!poolData
    }
  });

  // For withdrawals: get_dx(stusds_idx, usds_idx, usds_amount) → stusds input needed
  const {
    data: withdrawInput,
    isLoading: isWithdrawLoading,
    error: withdrawError,
    refetch: refetchWithdraw
  } = useReadCurveStUsdsUsdsPoolGetDx({
    args: [BigInt(stUsdsIndex), BigInt(usdsIndex), amount],
    chainId,
    query: {
      enabled: enabled && direction === StUsdsDirection.WITHDRAW && amount > 0n && !!poolData
    }
  });

  const data: CurveQuoteData | undefined = useMemo(() => {
    if (amount === 0n) return undefined;

    if (direction === StUsdsDirection.SUPPLY) {
      if (!depositOutput) return undefined;

      // For deposits: USDS in, stUSDS out
      const usdsAmount = amount;
      const stUsdsAmount = depositOutput;

      // Rate: stUSDS per USDS (how much stUSDS you get per USDS)
      const effectiveRate = (stUsdsAmount * RATE_PRECISION.WAD) / usdsAmount;

      // Calculate price impact using oracle
      let priceImpactBps = 0;
      if (poolData?.priceOracle && poolData.priceOracle > 0n) {
        // Expected rate = WAD / priceOracle (stUSDS per USDS)
        const expectedRate = (RATE_PRECISION.WAD * RATE_PRECISION.WAD) / poolData.priceOracle;
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
      if (!withdrawInput) return undefined;

      // For withdrawals: stUSDS in, USDS out
      const usdsAmount = amount;
      const stUsdsAmount = withdrawInput;

      // Rate: USDS per stUSDS (how much USDS you get per stUSDS burned)
      const effectiveRate = (usdsAmount * RATE_PRECISION.WAD) / stUsdsAmount;

      // Calculate price impact using oracle
      let priceImpactBps = 0;
      if (poolData?.priceOracle && poolData.priceOracle > 0n) {
        // Expected rate = priceOracle (USDS per stUSDS)
        const expectedRate = poolData.priceOracle;
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
    }
  }, [direction, amount, depositOutput, withdrawInput, poolData?.priceOracle]);

  const isLoading =
    isPoolLoading || (direction === StUsdsDirection.SUPPLY ? isDepositLoading : isWithdrawLoading);
  const error = direction === StUsdsDirection.SUPPLY ? depositError : withdrawError;

  const refetch = () => {
    if (direction === StUsdsDirection.SUPPLY) {
      refetchDeposit();
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
