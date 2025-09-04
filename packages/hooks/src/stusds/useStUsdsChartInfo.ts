import { useQuery } from '@tanstack/react-query';
import { parseEther } from 'viem';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { useChainId } from 'wagmi';
import { formatBaLabsUrl } from '../helpers';
import { ReadHook } from '../hooks';

type StUsdsChartInfo = {
  date: string;
  stusds_tvl: string;
};

type StUsdsChartInfoParsed = {
  blockTimestamp: number;
  amount: bigint;
};

function transformBaLabsChartData(results: StUsdsChartInfo[]): StUsdsChartInfoParsed[] {
  const parsed = results.map((item: StUsdsChartInfo) => {
    const stUsdsTvl = Number(item.stusds_tvl).toFixed(18); //remove scientific notation if it exists
    return {
      blockTimestamp: new Date(item?.date).getTime() / 1000,
      amount: parseEther(stUsdsTvl)
    };
  });
  return parsed;
}

async function fetchStUsdsChartInfo(url: URL): Promise<StUsdsChartInfoParsed[]> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data: { results: StUsdsChartInfo[] } = await response.json();

    const result = transformBaLabsChartData(data?.results || []);

    return result;
  } catch (error) {
    console.error('Error fetching BaLabs data:', error);
    return [];
  }
}

export function useStUsdsChartInfo(): ReadHook & { data?: StUsdsChartInfoParsed[] } {
  const chainId = useChainId();
  const baseUrl = getBaLabsApiUrl(chainId) || '';
  let url: URL | undefined;
  if (baseUrl) {
    const endpoint = `${baseUrl}/overall/historic/`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(baseUrl),
    queryKey: ['stusds-chart', url],
    queryFn: () => (url ? fetchStUsdsChartInfo(url) : Promise.resolve([]))
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
