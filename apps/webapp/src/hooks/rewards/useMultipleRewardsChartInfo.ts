import { ReadHook } from '../hooks';
import { baLabsDataSource } from '../constants';
import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';

import { fetchBaLabsPages, formatBaLabsUrl } from '../helpers';
import { toReadHook } from '../shared/toReadHook';
import { RewardsChartInfo, RewardsChartInfoParsed, transformRewardsChartData } from './useRewardsChartInfo';

async function fetchRewardsChartInfo(urls: URL[]): Promise<RewardsChartInfoParsed[][]> {
  // Each farm is fetched independently (and paged — the endpoint caps a response
  // at 1000 rows whatever p_size asks for) so one farm's failure leaves the
  // others' series intact.
  const settled = await Promise.allSettled(urls.map(url => fetchBaLabsPages<RewardsChartInfo>(url)));

  return settled.map((result, index) => {
    if (result.status !== 'fulfilled') {
      console.warn('Failed to fetch BaLabs data', { url: urls[index]?.href, error: result.reason });
      return [];
    }
    return transformRewardsChartData(result.value);
  });
}

export function useMultipleRewardsChartInfo({
  rewardContractAddresses,
  limit = 100
}: {
  rewardContractAddresses: string[];
  limit?: number;
}): ReadHook & { data?: RewardsChartInfoParsed[][] } {
  const baseUrl = getBaLabsApiUrl();
  const urls: URL[] = [];
  if (baseUrl && rewardContractAddresses.length > 0) {
    rewardContractAddresses.forEach(rewardContractAddress => {
      const endpoint = `${baseUrl}/farms/${rewardContractAddress.toLowerCase()}/historic/?p_size=${limit}`;
      urls.push(formatBaLabsUrl(new URL(endpoint)));
    });
  }

  const query = useQuery({
    enabled: Boolean(rewardContractAddresses.length > 0 && baseUrl),
    queryKey: ['reward-charts', urls],
    queryFn: () => (urls.length > 0 ? fetchRewardsChartInfo(urls) : Promise.resolve([]))
  });

  return toReadHook(
    query,
    urls.map(url => baLabsDataSource(url))
  );
}
