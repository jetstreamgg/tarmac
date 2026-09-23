import { ReadHook } from '../hooks';
import { ZERO_ADDRESS, indexerDataSource } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { useUserDelegates } from '../delegates/useUserDelegates';
import { useDelegates } from '../delegates/useDelegates';
import { useDelegateMetadataMapping } from '../delegates/useDelegateMetadataMapping';
import { findDelegateNameMatches } from '../delegates/utils';
import { DelegateInfo } from '../delegates/delegate';
import { useState, useMemo } from 'react';
import { formatEther, getAddress } from 'viem';

type DelegateInfoWithTotal = DelegateInfo & {
  totalDelegatedEther: number;
};

const sortDelegatesByTotalDelegatedFn = (a: DelegateInfoWithTotal, b: DelegateInfoWithTotal) =>
  b.totalDelegatedEther - a.totalDelegatedEther;
const sortDelegatesByAlignedFn = (a: DelegateInfoWithTotal, b: DelegateInfoWithTotal) => {
  // Sort by those with metadata first (aligned delegates)
  if (a.metadata && !b.metadata) return -1;
  if (!a.metadata && b.metadata) return 1;
  // If both have same metadata status, sort by total delegated
  return sortDelegatesByTotalDelegatedFn(a, b);
};

const sortDelegatesWithSelectedFirst = (
  delegates: DelegateInfoWithTotal[],
  selectedDelegateAddress: string,
  sortDelegatesFn: (a: DelegateInfoWithTotal, b: DelegateInfoWithTotal) => number
) => {
  const selectedDelegate = delegates.find(
    delegate => getAddress(delegate.id) === getAddress(selectedDelegateAddress)
  );
  const otherDelegates = delegates
    .filter(delegate => getAddress(delegate.id) !== getAddress(selectedDelegateAddress))
    .sort(sortDelegatesFn);

  return [...(selectedDelegate ? [selectedDelegate] : []), ...otherDelegates];
};

export function useStakeUserDelegates({
  indexerUrl,
  chainId,
  user,
  page = 1,
  pageSize = 100,
  random,
  search,
  selectedDelegate,
  shouldSortDelegates,
  sortType = 'aligned'
}: {
  indexerUrl?: string;
  chainId: number;
  user: `0x${string}`;
  page?: number;
  pageSize?: number;
  random?: boolean;
  search?: string;
  selectedDelegate?: `0x${string}`;
  shouldSortDelegates?: boolean;
  sortType?: 'totalDelegated' | 'aligned';
}): ReadHook & { data?: DelegateInfoWithTotal[] } {
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(chainId) || '';

  // Search matches delegate names too: names live only in the governance-portal
  // metadata, so resolve them to addresses here and let the indexer queries
  // filter by address (pagination and the user/rest split stay server-side).
  const { data: metadataMapping } = useDelegateMetadataMapping();
  const nameMatches = useMemo(
    () => findDelegateNameMatches(metadataMapping, search),
    [metadataMapping, search]
  );

  const {
    data: userDelegatesData,
    isLoading: isLoadingUserDelegates,
    error: errorUserDelegates,
    mutate: mutateUserDelegates
  } = useUserDelegates({ chainId, user: user || ZERO_ADDRESS, search, version: 3, nameMatches });

  const totalUserDelegates = userDelegatesData?.length || 0;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const userDelegatesPage = useMemo(
    () => userDelegatesData?.slice(startIndex, endIndex) || [],
    [userDelegatesData, startIndex, endIndex]
  );
  const remainingSlots = pageSize - userDelegatesPage.length;

  const excludeDelegates = userDelegatesData?.map(delegate => delegate.id);
  const {
    data: restDelegates,
    isLoading: isLoadingRestDelegates,
    error: errorRestDelegates,
    mutate: mutateRestDelegates
  } = useDelegates({
    chainId,
    exclude: excludeDelegates,
    page: Math.max(1, Math.ceil((startIndex - totalUserDelegates + 1) / pageSize)),
    pageSize: remainingSlots,
    random,
    search,
    version: 3,
    nameMatches
  });
  const isLoading = isLoadingUserDelegates || isLoadingRestDelegates;
  const isDataReady = user && user !== ZERO_ADDRESS && !isLoading && (userDelegatesData || restDelegates);

  const sortDelegatesFn =
    sortType === 'totalDelegated' ? sortDelegatesByTotalDelegatedFn : sortDelegatesByAlignedFn;

  // Memoize the delegates transformation to prevent unnecessary re-computations
  const delegatesWithTotals = useMemo(() => {
    if (!isDataReady) return undefined;

    return [...userDelegatesPage, ...(restDelegates || [])].map(delegate => ({
      ...delegate,
      totalDelegatedEther: delegate.totalDelegated ? Number(formatEther(delegate.totalDelegated)) : 0
    }));
  }, [isDataReady, userDelegatesPage, restDelegates]);

  // The display order is fixed the first time a search's results arrive and
  // held for that search, so selecting a delegate does not reshuffle the list
  // under the pointer. The next search (or its resolved name matches, which
  // can land after the metadata fetch) orders afresh. Set during render.
  const [ordered, setOrdered] = useState<{
    search?: string;
    nameMatches?: `0x${string}`[];
    list: DelegateInfoWithTotal[];
  }>();
  const orderedForThisSearch =
    ordered !== undefined && ordered.search === search && ordered.nameMatches === nameMatches;
  if (shouldSortDelegates && delegatesWithTotals && !orderedForThisSearch) {
    setOrdered({
      search,
      nameMatches,
      list:
        selectedDelegate && selectedDelegate !== ZERO_ADDRESS
          ? // A pre-selected delegate goes first in the list
            sortDelegatesWithSelectedFirst(delegatesWithTotals, selectedDelegate, sortDelegatesFn)
          : // Copy first: the memoized array must not be sorted in place.
            [...delegatesWithTotals].sort(sortDelegatesFn)
    });
  }
  const displayedDelegates = orderedForThisSearch ? ordered.list : undefined;

  return {
    isLoading,
    data: shouldSortDelegates ? displayedDelegates : delegatesWithTotals,
    error: errorUserDelegates || errorRestDelegates,
    mutate: () => {
      mutateUserDelegates();
      mutateRestDelegates();
    },
    dataSources: [indexerDataSource(urlIndexer)]
  };
}
