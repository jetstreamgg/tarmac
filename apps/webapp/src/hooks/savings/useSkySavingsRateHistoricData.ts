import { useQuery } from '@tanstack/react-query';
import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { baLabsDataSource } from '../constants';
import { ReadHook } from '../hooks';
import { toReadHook } from '../shared/toReadHook';
import { fetchJson } from '../shared/fetchJson';

type SkySavingsRateHistoricApiResponse = {
  date: string;
  datetime: string;
  total: string;
  depositors: number;
  rate: string;
};

type SkySavingsRateHistoricData = {
  blockTimestamp: number;
  total: string;
  depositors: number;
  rate: string;
};

function transformBaLabsData(results: SkySavingsRateHistoricApiResponse[]): SkySavingsRateHistoricData[] {
  return results.map(item => ({
    blockTimestamp: new Date(item.datetime).getTime() / 1000,
    total: item.total,
    depositors: item.depositors,
    rate: item.rate
  }));
}

async function fetchSkySavingsRateHistoric(url: URL): Promise<SkySavingsRateHistoricData[]> {
  try {
    const data = await fetchJson<{ historic: SkySavingsRateHistoricApiResponse[] }>(url, {
      label: 'Sky Savings Rate historic data'
    });
    return transformBaLabsData(data?.historic || []);
  } catch (error) {
    console.error('Error fetching Sky Savings Rate historic data:', error);
    return [];
  }
}

export function useSkySavingsRateHistoricData(
  props: { daysAgo?: number } = { daysAgo: 30 }
): ReadHook & { data?: SkySavingsRateHistoricData[] } {
  const { daysAgo } = props;
  const apiBase = getBaLabsApiUrl() || '';
  // /save/ssr/historic/ lives at the BA Labs root, not under /api/v1
  const rootBase = apiBase.replace(/\/api\/v1\/?$/, '');
  let url: URL | undefined;
  if (rootBase) {
    url = new URL(`${rootBase}/save/ssr/historic/?days_ago=${daysAgo}`);
  }

  const query = useQuery({
    enabled: Boolean(rootBase),
    queryKey: ['sky-savings-rate-historic', url?.href],
    queryFn: () => (url ? fetchSkySavingsRateHistoric(url) : Promise.resolve([]))
  });

  return toReadHook(query, [baLabsDataSource(url)]);
}
