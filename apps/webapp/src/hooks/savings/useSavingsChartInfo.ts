import { useQuery } from '@tanstack/react-query';
import { parseEther } from 'viem';
import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { useChainId } from 'wagmi';
import { fetchBaLabsPages, formatBaLabsUrl } from '../helpers';
import { sUsdsAddress } from './useReadSavingsUsds';
import { ReadHook } from '../hooks';

type SavingsChartInfo = {
  date: string;
  total_save: string;
};

type SavingsChartInfoParsed = {
  blockTimestamp: number;
  amount: bigint;
};

function transformBaLabsChartData(results: SavingsChartInfo[]): SavingsChartInfoParsed[] {
  const parsed = results.map((item: SavingsChartInfo) => {
    const savingsTvl = Number(item.total_save).toFixed(18); //remove scientific notation if it exists
    return {
      blockTimestamp: new Date(item?.date).getTime() / 1000,
      amount: parseEther(savingsTvl)
    };
  });
  return parsed;
}

async function fetchSavingsChartInfo(url: URL): Promise<SavingsChartInfoParsed[]> {
  try {
    // Paged: this endpoint caps a response at 1000 rows whatever p_size asks for.
    return transformBaLabsChartData(await fetchBaLabsPages<SavingsChartInfo>(url));
  } catch (error) {
    console.error('Error fetching BaLabs data:', error);
    return [];
  }
}

export function useSavingsChartInfo(
  paramChainId?: number,
  options: { limit?: number } = { limit: 100 }
): ReadHook & { data?: SavingsChartInfoParsed[] } {
  const { limit } = options;
  const wagmiChainId = useChainId();
  const chainId = paramChainId || wagmiChainId;
  const baseUrl = getBaLabsApiUrl() || '';
  const savingsAddress = sUsdsAddress[chainId as keyof typeof sUsdsAddress];
  let url: URL | undefined;
  if (baseUrl && savingsAddress) {
    const endpoint = `${baseUrl}/overall/historic/?p_size=${limit}`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(baseUrl && savingsAddress),
    queryKey: ['savings-chart', url],
    queryFn: () => (url ? fetchSavingsChartInfo(url) : Promise.resolve([]))
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
