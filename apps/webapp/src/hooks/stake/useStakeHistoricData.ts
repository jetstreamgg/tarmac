import { useChainId } from 'wagmi';
import { ReadHook } from '../hooks';
import { useQuery } from '@tanstack/react-query';
import { baLabsDataSource } from '../constants';
import { formatBaLabsUrl } from '../helpers';
import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { fetchJson } from '../shared/fetchJson';

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

/**
 * The newest datapoint by `datetime` (first one on ties), independent of any
 * timeframe filter — what the chart's TVL hero and the Details strip's
 * historic rows read. Current borrow rate surfaces read the onchain stability
 * fee instead (APP-640); the chart only falls back to this point's
 * `borrowRate` until that read lands.
 */
export function newestStakeHistoricPoint(data?: StakeHistoricData[]): StakeHistoricData | undefined {
  return data?.reduce<StakeHistoricData | undefined>(
    (newest, item) =>
      newest === undefined || new Date(item.datetime).getTime() > new Date(newest.datetime).getTime()
        ? item
        : newest,
    undefined
  );
}

const fetchStakeHistoricData = async (url: URL): Promise<StakeHistoricData[] | undefined> => {
  try {
    const data = await fetchJson<ApiStakeHistoricData[]>(url, { label: 'Stake historic data' });
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
  const baseUrl = getBaLabsApiUrl() || '';
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
    dataSources: [baLabsDataSource(url)]
  };
}
