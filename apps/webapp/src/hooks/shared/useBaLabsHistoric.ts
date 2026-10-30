import { useQuery } from '@tanstack/react-query';
import { getBaLabsApiUrl } from '../helpers/getIndexerUrl';
import { fetchBaLabsPages, formatBaLabsUrl } from '../helpers';
import { baLabsDataSource } from '../constants';
import { ReadHook } from '../hooks';
import { toReadHook } from './toReadHook';

export type BaLabsHistoricHook<T> = ReadHook & {
  data?: T[];
  /** `data` is still the previous range's: parse it with that range (useSettledTimeFrame). */
  isPlaceholderData: boolean;
};

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
  /** Query-key prefix; the path, row budget and enabled state are the other key parts. */
  queryKey: string;
  transform: (rows: TRaw[]) => TParsed[];
  /** Extra precondition on top of the API root being configured. */
  enabled?: boolean;
}): BaLabsHistoricHook<TParsed> {
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
    // The enabled state keeps a disabled caller on its own empty entry instead
    // of reading the series an enabled one cached under the same path.
    queryKey: [queryKey, path, limit, Boolean(url)],
    queryFn: () => (url ? fetchHistoric(url) : Promise.resolve([])),
    // A timeframe switch only changes `limit`: keep the series on screen while
    // the new range loads, instead of flashing the skeleton (APP-407). Only for
    // the same series — another farm or vault starts from the skeleton rather
    // than briefly showing the previous one's data.
    placeholderData: (previousData, previousQuery) =>
      url && previousQuery?.queryKey[1] === path ? previousData : undefined
  });

  return { ...toReadHook(query, [baLabsDataSource(url)]), isPlaceholderData: query.isPlaceholderData };
}
