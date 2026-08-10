import { useQuery } from '@tanstack/react-query';
import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';

import { fetchBaLabsPages, formatBaLabsUrl } from '../helpers';
import { ReadHook } from '../hooks';

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

async function fetchUsdsDaiData(url: URL): Promise<UsdsDaiChartInfo[]> {
  try {
    // Paged: this endpoint caps a response at 1000 rows whatever p_size asks for,
    // which cut the All-time chart off at Nov 2023 (APP-456 #5).
    return transformBaLabsData(await fetchBaLabsPages<UsdsDaiApiResponse>(url));
  } catch (error) {
    console.error('Error fetching BaLabs data:', error);
    return [];
  }
}

export function useUsdsDaiData(
  props: { limit?: number } = { limit: 100 }
): ReadHook & { data?: UsdsDaiChartInfo[] } {
  const { limit } = props;
  const baseUrl = getBaLabsApiUrl() || '';
  let url: URL | undefined;
  if (baseUrl) {
    const endpoint = `${baseUrl}/overall/historic/?p_size=${limit}`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(baseUrl),
    queryKey: ['usds-dai-data', url],
    queryFn: () => (url ? fetchUsdsDaiData(url) : Promise.resolve([]))
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'BA Labs API',
        href: url?.href || 'https://blockanalitica.com/',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
