import { ReadHook } from '../hooks';
import { useBaLabsHistoric } from '../shared/useBaLabsHistoric';

export type RewardsChartInfo = {
  apr: string;
  cRate: string;
  date: string;
  depositors: number;
  price: string;
  staked_volume: string;
  total_farmed: string;
  total_staked: string;
  withdraw_volume: string;
};

export type RewardsChartInfoParsed = {
  blockTimestamp: number;
  price: string;
  suppliers: number;
  suppliedVolume: string;
  totalRewarded: string;
  totalSupplied: string;
  withdrawVolume: string;
  rate: string;
};

export function transformRewardsChartData(results: RewardsChartInfo[]): RewardsChartInfoParsed[] {
  const parsed = results.map((item: RewardsChartInfo) => {
    return {
      blockTimestamp: new Date(item.date).getTime() / 1000,
      price: item.price,
      suppliers: item.depositors,
      suppliedVolume: item.staked_volume,
      totalRewarded: item.total_farmed,
      totalSupplied: item.total_staked,
      withdrawVolume: item.withdraw_volume,
      rate: item.apr
    };
  });
  return parsed;
}

export function useRewardsChartInfo({
  rewardContractAddress,
  limit = 100
}: {
  rewardContractAddress: string;
  limit?: number;
}): ReadHook & { data?: RewardsChartInfoParsed[] } {
  return useBaLabsHistoric<RewardsChartInfo, RewardsChartInfoParsed>({
    path: `/farms/${rewardContractAddress.toLowerCase()}/historic/`,
    limit,
    queryKey: 'reward-chart',
    transform: transformRewardsChartData,
    enabled: Boolean(rewardContractAddress)
  });
}
