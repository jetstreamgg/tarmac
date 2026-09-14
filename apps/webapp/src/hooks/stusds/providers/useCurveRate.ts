import { useMemo } from 'react';
import { useCurveQuote } from './useCurveQuote';
import { StUsdsDirection } from './types';
import { RATE_PRECISION } from './constants';

export type CurveRateResult = {
  curveRate: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook to get the current exchange rate from the Curve pool.
 * Calculates the average of buy and sell rates to provide a balanced mid-market rate.

 */
export function useCurveRate(): CurveRateResult {
  // Get quote for withdrawing: takes 1 USDS as desired output, returns required stUSDS input
  const {
    data: withdrawQuote,
    isLoading: isWithdrawLoading,
    error: withdrawError
  } = useCurveQuote({
    direction: StUsdsDirection.WITHDRAW,
    amount: RATE_PRECISION.WAD, // 1 USDS desired output
    enabled: true
  });

  // Get quote for supplying: takes 1 USDS as input, returns stUSDS output
  const {
    data: supplyQuote,
    isLoading: isSupplyLoading,
    error: supplyError
  } = useCurveQuote({
    direction: StUsdsDirection.SUPPLY,
    amount: RATE_PRECISION.WAD, // 1 USDS input
    enabled: true
  });

  const curveRate = useMemo(() => {
    if (!withdrawQuote || !supplyQuote) {
      return undefined;
    }

    const withdrawRate =
      withdrawQuote.stUsdsAmount > 0n
        ? (RATE_PRECISION.WAD * RATE_PRECISION.WAD) / withdrawQuote.stUsdsAmount
        : 0n;

    const supplyRate =
      supplyQuote.stUsdsAmount > 0n
        ? (RATE_PRECISION.WAD * RATE_PRECISION.WAD) / supplyQuote.stUsdsAmount
        : 0n;

    if (withdrawRate === 0n) return supplyRate > 0n ? supplyRate : undefined;
    if (supplyRate === 0n) return withdrawRate;

    return (withdrawRate + supplyRate) / 2n;
  }, [withdrawQuote, supplyQuote]);

  return {
    curveRate,
    isLoading: isWithdrawLoading || isSupplyLoading,
    error: withdrawError || supplyError || null
  };
}
