import { useMemo } from 'react';
import {
  useHighestRateFromChartData,
  useMultipleRewardsChartInfo,
  useStakeRewardContracts,
  type EarnProductRow
} from '@/hooks';
import { formatDecimalPercentage } from '@/utils';
import { NO_VALUE } from '@/lib/constants';
import { useGeoConfig } from '@/modules/geo-config';
import { buildEarnWithSkyProducts, type EarnWithSkyProduct } from '../helpers/earnWithSky';

const NO_CHARTS: never[] = [];

/**
 * The "Earn with Sky" cards for a set of (geo-visible) marketplace rows. Stake
 * has no marketplace row, so its rate is resolved here — the highest stake
 * reward rate, the same source the Stake page and wallet drawer read — and it
 * is geo-gated the way useGeoVisibleRows gates the rows: available until the
 * config says otherwise.
 */
export function useEarnWithSkyProducts(rows: EarnProductRow[]): EarnWithSkyProduct[] {
  const { isModuleEnabled, isLoading: isGeoLoading } = useGeoConfig();
  const stakeAvailable = isGeoLoading || isModuleEnabled('stake');

  const { data: stakeRewardContracts, isLoading: contractsLoading } = useStakeRewardContracts();
  const { data: stakeCharts, isLoading: chartsLoading } = useMultipleRewardsChartInfo({
    rewardContractAddresses: stakeRewardContracts?.map(({ contractAddress }) => contractAddress) ?? []
  });
  const highestStakeRate = useHighestRateFromChartData(stakeCharts ?? NO_CHARTS);
  const stakeRate = highestStakeRate ? parseFloat(highestStakeRate.rate) : undefined;
  const stakeLoading = contractsLoading || chartsLoading;

  return useMemo(
    () =>
      buildEarnWithSkyProducts(rows, {
        rate:
          stakeRate !== undefined && !isNaN(stakeRate) && stakeRate > 0
            ? { value: stakeRate, formatted: formatDecimalPercentage(stakeRate) }
            : { formatted: NO_VALUE },
        isLoading: stakeLoading,
        isAvailable: stakeAvailable
      }),
    [rows, stakeRate, stakeLoading, stakeAvailable]
  );
}
