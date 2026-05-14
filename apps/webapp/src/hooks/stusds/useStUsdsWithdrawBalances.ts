import { useMemo } from 'react';
import { useStUsdsData } from './useStUsdsData';
import { useStUsdsProviderSelection } from './providers/useStUsdsProviderSelection';
import { useCurveQuote } from './providers/useCurveQuote';
import { StUsdsDirection, StUsdsProviderType } from './providers/types';

/**
 * Provides withdraw balance data using rate comparison for display and max button.
 */
export function useStUsdsWithdrawBalances() {
  const { data: stUsdsData, isLoading: isDataLoading, error: dataError } = useStUsdsData();
  const userStUsdsBalance = stUsdsData?.userStUsdsBalance ?? 0n;

  const providerSelection = useStUsdsProviderSelection({
    direction: StUsdsDirection.WITHDRAW,
    amount: userStUsdsBalance,
    userStUsdsBalance
  });

  const { data: curveMaxQuote, isLoading: isCurveLoading } = useCurveQuote({
    direction: StUsdsDirection.WITHDRAW,
    amount: 0n,
    userStUsdsBalance,
    isMax: true,
    enabled: userStUsdsBalance > 0n
  });

  const curveMaxWithdraw = curveMaxQuote?.usdsAmount;
  const nativeBalance = stUsdsData?.userSuppliedUsds;

  const effectiveBalance = useMemo(() => {
    if (providerSelection.selectedProvider === StUsdsProviderType.CURVE) {
      return curveMaxWithdraw ?? nativeBalance ?? 0n;
    }
    return nativeBalance ?? 0n;
  }, [providerSelection.selectedProvider, curveMaxWithdraw, nativeBalance]);

  return {
    effectiveBalance,
    curveMaxWithdraw,
    nativeBalance,
    userStUsdsBalance,
    selectedProvider: providerSelection.selectedProvider,
    isLoading: isDataLoading || providerSelection.isLoading || isCurveLoading,
    error: dataError
  };
}
