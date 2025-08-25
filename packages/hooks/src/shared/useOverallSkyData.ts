import { useQuery } from '@tanstack/react-query';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { formatBaLabsUrl } from '../helpers';
import { ReadHook } from '../hooks';

type OverallSkyApiResponse = {
  sky_savings_rate_apy?: string;
  sky_savings_rate_tvl?: string;
  sky_farm_apy?: string;
  total_reward_tvl?: string;
  total_save?: string;
  sky_ecosystem_tvl?: string;
  ssr_depositor_count?: number;
  sky_price_usd?: string;
  usdc_price_usd?: string;
  weth_price_usd?: string;
  usds_price_usd?: string;
  usdt_price_usd?: string;
};

type OverallSkyData = {
  skySavingsRatecRate: string;
  skySavingsRateTvl: string;
  usdsSkyCRate: string;
  totalRewardTvl: string;
  totalSavingsTvl: string;
  skyEcosystemTvl: string;
  ssrSuppliers: number;
  skyPriceUsd: string;
  usdcPriceUsd: string;
  wethPriceUsd: string;
  usdsPriceUsd: string;
  usdtPriceUsd: string;
};

function transformOverallSkyData(data: OverallSkyApiResponse[]): OverallSkyData {
  const result: OverallSkyData = {
    skySavingsRatecRate: '',
    skySavingsRateTvl: '',
    usdsSkyCRate: '',
    totalRewardTvl: '',
    totalSavingsTvl: '',
    skyEcosystemTvl: '',
    ssrSuppliers: 0,
    skyPriceUsd: '',
    usdcPriceUsd: '',
    wethPriceUsd: '',
    usdsPriceUsd: '',
    usdtPriceUsd: ''
  };

  data.forEach((item: OverallSkyApiResponse) => {
    if ('sky_savings_rate_apy' in item) {
      result.skySavingsRatecRate = item.sky_savings_rate_apy ?? '';
      result.skySavingsRateTvl = item.sky_savings_rate_tvl ?? '';
      result.usdsSkyCRate = item.sky_farm_apy ?? '';
      result.totalRewardTvl = item.total_reward_tvl ?? '';
      result.totalSavingsTvl = item.total_save ?? '';
      result.skyEcosystemTvl = item.sky_ecosystem_tvl ?? '';
      result.ssrSuppliers = item.ssr_depositor_count ?? 0;
    } else if ('sky_price_usd' in item) {
      result.skyPriceUsd = item.sky_price_usd ?? '';
    } else if ('usdc_price_usd' in item) {
      result.usdcPriceUsd = item.usdc_price_usd ?? '';
    } else if ('weth_price_usd' in item) {
      result.wethPriceUsd = item.weth_price_usd ?? '';
    } else if ('usds_price_usd' in item) {
      result.usdsPriceUsd = item.usds_price_usd ?? '';
    } else if ('usdt_price_usd' in item) {
      result.usdtPriceUsd = item.usdt_price_usd ?? '';
    }
  });

  return result;
}

async function fetchOverallSkyData(url: URL): Promise<OverallSkyData> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data: OverallSkyApiResponse[] = await response.json();
    return transformOverallSkyData(data);
  } catch (error) {
    console.error('Error fetching Overall Sky data:', error);
    throw error;
  }
}

export function useOverallSkyData(): ReadHook & { data?: OverallSkyData } {
  const baseUrl = getBaLabsApiUrl();
  let url: URL | undefined;
  if (baseUrl) {
    const endpoint = `${baseUrl}/overall/`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(baseUrl),
    queryKey: ['overall-sky-data', url],
    queryFn: () => (url ? fetchOverallSkyData(url) : Promise.reject('No URL available'))
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
