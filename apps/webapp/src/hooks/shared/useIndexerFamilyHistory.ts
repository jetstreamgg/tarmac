import { useConnection, useChainId } from 'wagmi';
import { request, gql } from 'graphql-request';
import { familyMainnetId } from '@/utils';
import { ReadHook } from '../hooks';
import { indexerDataSource } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { historyPageBoundary, clampHistoryPage, HistoryPage } from './historyQueryHelpers';
import { useHistoryPagination, PaginatedHistory } from './useHistoryPagination';

/** What a family's fragment builder needs for one page. */
type IndexerHistoryFragmentArgs = {
  /** Lowercased wallet address (the indexer stores addresses lowercase). */
  owner: string;
  chainId: number;
  beforeTimestamp?: number;
};

/** The resolved inputs a family's query key is built from. */
type IndexerHistoryKeyContext = {
  urlIndexer: string;
  address: string | undefined;
  chainId: number;
};

/**
 * One connected wallet's keyset-paginated history from the Sky Ecosystem
 * indexer. Wraps the per-family boilerplate — wallet + chain resolution, the
 * page fetcher (fragments → request → completeness boundary → clamp) and the
 * indexer data source — around useHistoryPagination.
 *
 * Chain resolution: `familyMainnet` queries the family's Ethereum chain
 * (mainnet, or the Tenderly fork in dev) whatever the wallet is on, while the
 * indexer URL still follows the connected chain; otherwise the explicit
 * `chainId` (or the connected chain) drives both.
 */
export function useIndexerFamilyHistory<T extends { blockTimestamp: Date }>({
  indexerUrl,
  chainId,
  familyMainnet = false,
  enabled = true,
  requireAddress = false,
  ready = true,
  queryKey,
  fragments,
  mapPage,
  sortDesc = false
}: {
  indexerUrl?: string;
  /** Explicit chain to query (the L2 hooks); ignored under `familyMainnet`. */
  chainId?: number;
  familyMainnet?: boolean;
  /** Extra precondition on top of the indexer URL being configured. */
  enabled?: boolean;
  /** Also disable the query while no wallet is connected. */
  requireAddress?: boolean;
  /** Extra precondition checked inside the fetcher (a manual refetch can run while disabled). */
  ready?: boolean;
  queryKey: (ctx: IndexerHistoryKeyContext) => readonly unknown[];
  fragments: (args: IndexerHistoryFragmentArgs) => string;
  mapPage: (response: any, chainId: number) => T[];
  /** Re-sort the mapped page newest-first when the mapper interleaves lists unsorted. */
  sortDesc?: boolean;
}): ReadHook & PaginatedHistory & { data?: T[] } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlChainId = chainId ?? currentChainId;
  const chainIdToUse = familyMainnet ? familyMainnetId(currentChainId) : urlChainId;
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(urlChainId) || '';

  const fetchPage = async (beforeTimestamp?: number): Promise<HistoryPage<T>> => {
    if (!address || !ready) return { items: [], nextCursor: undefined };
    const query = gql`
      {
        ${fragments({ owner: address.toLowerCase(), chainId: chainIdToUse, beforeTimestamp })}
      }
    `;
    const response = (await request(urlIndexer, query)) as any;
    const nextCursor = historyPageBoundary(response);
    const items = mapPage(response, chainIdToUse);
    if (sortDesc) items.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
    return { items: clampHistoryPage(items, nextCursor), nextCursor };
  };

  const { data, isLoading, error, mutate, nextCursor, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHistoryPagination({
      enabled: Boolean(urlIndexer) && enabled && (!requireAddress || Boolean(address)),
      queryKey: queryKey({ urlIndexer, address, chainId: chainIdToUse }),
      fetchPage
    });

  return {
    data,
    isLoading,
    error: error as Error,
    mutate,
    nextCursor,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    dataSources: [indexerDataSource(urlIndexer)]
  };
}
