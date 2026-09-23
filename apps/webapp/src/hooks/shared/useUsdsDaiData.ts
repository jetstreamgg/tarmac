import { ReadHook } from '../hooks';
import { useBaLabsHistoric } from './useBaLabsHistoric';

type UsdsDaiApiResponse = {
  datetime: string;
  total_dai: string;
  total_usds: string;
  surplus_buffer: string;
  total: string;
};

type UsdsDaiChartInfo = {
  blockTimestamp: number;
  totalDai: string;
  totalUsds: string;
  surplusBuffer: string;
  total: string;
};

function transformBaLabsData(results: UsdsDaiApiResponse[]): UsdsDaiChartInfo[] {
  const parsed = results.map((item: UsdsDaiApiResponse) => {
    return {
      blockTimestamp: new Date(item?.datetime).getTime() / 1000,
      totalDai: item.total_dai,
      totalUsds: item.total_usds,
      surplusBuffer: item.surplus_buffer,
      total: item.total
    };
  });
  return parsed;
}

export function useUsdsDaiData(
  props: { limit?: number } = { limit: 100 }
): ReadHook & { data?: UsdsDaiChartInfo[] } {
  const { limit } = props;

  // Paged: the endpoint caps a response at 1000 rows whatever p_size asks for,
  // which cut the All-time chart off at Nov 2023 (APP-456 #5).
  return useBaLabsHistoric<UsdsDaiApiResponse, UsdsDaiChartInfo>({
    path: '/overall/historic/',
    limit,
    queryKey: 'usds-dai-data',
    transform: transformBaLabsData
  });
}
