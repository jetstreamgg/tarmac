import { useQuery } from '@tanstack/react-query';
import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { fetchBaLabsPages, formatBaLabsUrl } from '../helpers';
import { baLabsDataSource } from '../constants';
import { ReadHook } from '../hooks';
import { toReadHook } from './toReadHook';

/** Whether two query keys name the same series, ignoring the `p_size` row budget. */
function sameSeries(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a[0] !== b[0] || !a[1] || !b[1]) return false;
  const withoutSize = (target: unknown) => {
    const href = new URL(String(target));
    href.searchParams.delete('p_size');
    return href.href;
  };
  return withoutSize(a[1]) === withoutSize(b[1]);
}

/**
 * A paged BA Labs `historic` series, parsed into chart points. The endpoint
 * caps a response at 1000 rows whatever `p_size` asks for, so every page is
 * walked (see fetchBaLabsPages); a failed walk logs and yields an empty series.
 */
export function useBaLabsHistoric<TRaw, TParsed>({
  path,
  limit,
  queryKey,
  transform,
  enabled = true
}: {
  /** Endpoint path under the BA Labs API root, e.g. `/overall/historic/`. */
  path: string;
  /** Row budget (`p_size`), passed through verbatim. */
  limit?: number;
  /** Query-key prefix; the URL is the second key part. */
  queryKey: string;
  transform: (rows: TRaw[]) => TParsed[];
  /** Extra precondition on top of the API root being configured. */
  enabled?: boolean;
}): ReadHook & { data?: TParsed[] } {
  const baseUrl = getBaLabsApiUrl() || '';
  let url: URL | undefined;
  if (baseUrl && enabled) {
    const endpoint = `${baseUrl}${path}?p_size=${limit}`;
    url = formatBaLabsUrl(new URL(endpoint));
  }

  const fetchHistoric = async (target: URL): Promise<TParsed[]> => {
    try {
      return transform(await fetchBaLabsPages<TRaw>(target));
    } catch (error) {
      console.error('Error fetching BaLabs data:', error);
      return [];
    }
  };

  const query = useQuery({
    enabled: Boolean(url),
    queryKey: [queryKey, url],
    queryFn: () => (url ? fetchHistoric(url) : Promise.resolve([])),
    // A timeframe switch only changes `p_size`: keep the series on screen while
    // the new range loads, instead of flashing the skeleton (APP-407). Only for
    // the same series — another farm or vault starts from the skeleton rather
    // than briefly showing the previous one's data.
    placeholderData: (previousData, previousQuery) =>
      previousQuery && sameSeries(previousQuery.queryKey, [queryKey, url]) ? previousData : undefined
  });

  return toReadHook(query, [baLabsDataSource(url)]);
}
