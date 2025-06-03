import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useUserDelegates } from '../delegates/useUserDelegates';
import { useDelegates } from '../delegates/useDelegates';
import { DelegateInfo } from '../delegates/delegate';
import { useEffect, useRef, useState, useMemo } from 'react';
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
  subgraphUrl,
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
  subgraphUrl?: string;
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
  const hasInitiallyOrdered = useRef(false);
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data: userDelegatesData,
    isLoading: isLoadingUserDelegates,
    error: errorUserDelegates,
    mutate: mutateUserDelegates
  } = useUserDelegates({ chainId, user: user || ZERO_ADDRESS, search, version: 3 });

  const totalUserDelegates = userDelegatesData?.length || 0;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const userDelegatesPage = userDelegatesData?.slice(startIndex, endIndex) || [];
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
    version: 3
  });
  const isLoading = isLoadingUserDelegates || isLoadingRestDelegates;
  const isDataReady = user && user !== ZERO_ADDRESS && !isLoading && (userDelegatesData || restDelegates);

  const delegates = isDataReady ? [...userDelegatesPage, ...(restDelegates || [])] : undefined;
  const [displayedDelegates, setDisplayedDelegates] = useState<DelegateInfoWithTotal[]>();

  const sortDelegatesFn =
    sortType === 'totalDelegated' ? sortDelegatesByTotalDelegatedFn : sortDelegatesByAlignedFn;

  // Memoize the delegates transformation to prevent unnecessary re-computations
  const delegatesWithTotals = useMemo(() => {
    if (!delegates) return undefined;

    return delegates.map(delegate => ({
      ...delegate,
      totalDelegatedEther: delegate.totalDelegated ? Number(formatEther(delegate.totalDelegated)) : 0
    }));
  }, [delegates]);

  // One-time setup of delegate list order when data first loads
  // Runs independently of the selected delegate changing
  useEffect(() => {
    if (!delegatesWithTotals || hasInitiallyOrdered.current || !shouldSortDelegates) return;

    hasInitiallyOrdered.current = true;

    if (selectedDelegate && selectedDelegate !== ZERO_ADDRESS) {
      // If there's a pre-selected delegate, put it first in the list
      const orderedDelegates = sortDelegatesWithSelectedFirst(
        delegatesWithTotals,
        selectedDelegate,
        sortDelegatesFn
      );
      setDisplayedDelegates(orderedDelegates);
    } else {
      // No pre-selected delegate, just sort by total delegated amount
      const sortedDelegates = delegatesWithTotals.sort(sortDelegatesFn);
      setDisplayedDelegates(sortedDelegates);
    }
  }, [delegatesWithTotals, shouldSortDelegates, sortDelegatesFn, selectedDelegate]);

  return {
    isLoading,
    data: shouldSortDelegates ? displayedDelegates : delegatesWithTotals,
    error: errorUserDelegates || errorRestDelegates,
    mutate: () => {
      mutateUserDelegates();
      mutateRestDelegates();
    },
    dataSources: [
      {
        title: 'Sky Ecosystem subgraph',
        href: urlSubgraph,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
