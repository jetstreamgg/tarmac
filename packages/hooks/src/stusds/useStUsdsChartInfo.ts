import { useQuery } from '@tanstack/react-query';
import { parseEther } from 'viem';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { useChainId } from 'wagmi';
import { formatBaLabsUrl } from '../helpers';
import { ReadHook } from '../hooks';

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
