import { useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { formatBaLabsUrl } from '../helpers';
import { getBaLabsApiUrl } from '../helpers/getSubgraphUrl';

type ApiStakeHistoricData = {
  date: string;
  datetime: string;
  total_sky: string;
  total_collateral: string;
  total_debt: string;
  borrow_rate: string;
  tvl: string;
  number_of_urns: number;
  total_rewards: string;
  sky_price: string;
};

type StakeHistoricData = {
  date: string;
  datetime: string;
  totalSky: number;
  totalCollateral: number;
  totalDebt: number;
  borrowRate: number;
  tvl: number;
  numberOfUrns: number;
  totalRewards: number;
  skyPrice: number;
};

const fetchStakeHistoricData = async (url: URL): Promise<StakeHistoricData[] | undefined> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const data: ApiStakeHistoricData[] = await response.json();
    return data.map(item => ({
      date: item.date,
      datetime: item.datetime,
      totalSky: parseFloat(item.total_sky),
      totalCollateral: parseFloat(item.total_collateral),
      totalDebt: parseFloat(item.total_debt),
      borrowRate: parseFloat(item.borrow_rate),
      tvl: parseFloat(item.tvl),
      numberOfUrns: item.number_of_urns,
      totalRewards: parseFloat(item.total_rewards),
      skyPrice: parseFloat(item.sky_price)
    }));
  } catch (error) {
    console.error('Error fetching Stake historic data:', error);
    return undefined;
  }
};

export function useStakeHistoricData(): ReadHook & { data?: StakeHistoricData[] } {
  const chainId = useChainId();

  // Note: Tenderly not supported for this endpoint
  const baseUrl = getBaLabsApiUrl(chainId) || '';
  let url: URL | undefined;
  if (baseUrl) {
    const endpoint = `${baseUrl}/lsev2/historic/`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stake-historic-data', chainId],
    queryFn: () => (url ? fetchStakeHistoricData(url) : Promise.resolve(undefined))
  });

  return {
    data,
    isLoading,
    error,
    mutate: refetch,
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
