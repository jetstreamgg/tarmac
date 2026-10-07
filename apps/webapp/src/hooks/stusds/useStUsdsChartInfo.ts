import { parseEther } from 'viem';
import { ReadHook } from '../hooks';
import { useBaLabsHistoric } from '../shared/useBaLabsHistoric';

type StUsdsChartInfo = {
  date: string;
  stusds_tvl: string | null;
  stusds_rate: string | null;
};

type StUsdsChartInfoParsed = {
  blockTimestamp: number;
  amount: bigint;
  rate?: bigint;
};

function transformBaLabsChartData(results: StUsdsChartInfo[]): StUsdsChartInfoParsed[] {
  const parsed = results.map((item: StUsdsChartInfo) => {
    const result: StUsdsChartInfoParsed = {
      blockTimestamp: new Date(item?.date).getTime() / 1000,
      amount: 0n // Default tvl amount
    };

    if (item.stusds_tvl !== null) {
      const stUsdsTvl = Number(item.stusds_tvl).toFixed(18); //remove scientific notation if it exists
      result.amount = parseEther(stUsdsTvl);
    }

    if (item.stusds_rate !== null) {
      const stUsdsRate = Number(item.stusds_rate).toFixed(18); //remove scientific notation if it exists
      result.rate = parseEther(stUsdsRate);
    }

    return result;
  });
  return parsed;
}

export function useStUsdsChartInfo(
  options: { limit?: number } = { limit: 100 }
): ReadHook & { data?: StUsdsChartInfoParsed[] } {
  const { limit } = options;

  // `p_size` is required: without it the endpoint serves its 100-row default,
  // which silently clipped the detail chart's 1Y and All ranges to the last
  // ~100 days (APP-456 #5).
  return useBaLabsHistoric<StUsdsChartInfo, StUsdsChartInfoParsed>({
    path: '/overall/historic/',
    limit,
    queryKey: 'stusds-chart',
    transform: transformBaLabsChartData
  });
}
