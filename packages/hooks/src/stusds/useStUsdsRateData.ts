import { useMemo } from 'react';
import { useStUsdsData } from './useStUsdsData';
import { ReadHook } from '../hooks';

export type StUsdsRateData = {
  currentStusdsRate: bigint; // Current APY
  totalRateEarned: bigint; // Total rate earned in vault
  userRateEarned: bigint; // User's accrued rate
  projectedRate: bigint; // Projected annual rate
};

export type StUsdsRateDataHook = ReadHook & {
  data?: StUsdsRateData;
};

export function useStUsdsRateData(): StUsdsRateDataHook {
  const { data: stUsdsData, isLoading, error, mutate } = useStUsdsData();

  const data = useMemo<StUsdsRateData | undefined>(() => {
    if (!stUsdsData) return undefined;

    // Calculate current stusds rate from ysr (yield stusds rate)
    const currentStusdsRate = stUsdsData.moduleRate;

    // Calculate total rate earned in the vault
    // This would be the difference between current assets and what was originally deposited
    // For now, we'll use a simplified calculation
    const totalRateEarned =
      stUsdsData.totalAssets > stUsdsData.totalSupply ? stUsdsData.totalAssets - stUsdsData.totalSupply : 0n;

    // Calculate user's accrued rate
    // User's current balance minus what they would have without rate
    const userAssetValue = (stUsdsData.userStUsdsBalance * stUsdsData.assetPerShare) / 10n ** 18n;
    const userRateEarned =
      userAssetValue > stUsdsData.userStUsdsBalance ? userAssetValue - stUsdsData.userStUsdsBalance : 0n;

    // Project annual rate based on current rate
    // This is a simplified calculation - in practice you'd want more sophisticated modeling
    const projectedRate = (stUsdsData.userStUsdsBalance * currentStusdsRate) / 10n ** 18n;

    return {
      currentStusdsRate,
      totalRateEarned,
      userRateEarned,
      projectedRate
    };
  }, [stUsdsData]);

  return {
    isLoading,
    data,
    error,
    mutate,
    dataSources: []
  };
}
