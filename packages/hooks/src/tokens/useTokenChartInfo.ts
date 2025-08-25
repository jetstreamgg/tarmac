import { useQuery } from '@tanstack/react-query';
import { parseEther } from 'viem';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { formatBaLabsUrl } from '../helpers';
import { ReadHook } from '../hooks';

type TokenChartInfo = {
  date: string;
  total_supply: string;
  price: string;
  holders: number;
};

export type TokenChartInfoParsed = {
  blockTimestamp: number;
  amount: bigint;
  price: string;
  holders: number;
};

function transformBaLabsChartData(results: TokenChartInfo[]): TokenChartInfoParsed[] {
  const parsed = results.map((item: TokenChartInfo) => {
    const normalizedSupply = Number(item.total_supply).toFixed(18); //remove scientific notation if it exists
    return {
      blockTimestamp: new Date(item?.date).getTime() / 1000,
      amount: parseEther(normalizedSupply),
      price: item.price,
      holders: item.holders
    };
  });
  return parsed;
}

async function fetchTokenChartInfo(url: URL): Promise<TokenChartInfoParsed[]> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data: { results: TokenChartInfo[] } = await response.json();

    const result = transformBaLabsChartData(data?.results || []);

    return result;
  } catch (error) {
    console.error('Error fetching BaLabs data:', error);
    return [];
  }
}

export function useTokenChartInfo({
  tokenAddress
}: {
  tokenAddress: string;
}): ReadHook & { data?: TokenChartInfoParsed[] } {
  const baseUrl = getBaLabsApiUrl();

  let url: URL | undefined;
  if (baseUrl && tokenAddress) {
    const endpoint = `${baseUrl}/tokens/${tokenAddress.toLowerCase()}/historic/`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(baseUrl && tokenAddress),
    queryKey: [`${tokenAddress}-chart`, url],
    queryFn: () => (url ? fetchTokenChartInfo(url) : Promise.resolve([]))
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
