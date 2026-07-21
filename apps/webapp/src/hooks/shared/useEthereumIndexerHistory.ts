import { useMemo } from 'react';
import { request, gql } from 'graphql-request';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { HISTORY_STALE_TIME } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { savingsHistoryFragments, mapSavingsHistoryResponse } from '../savings/useEthereumSavingsHistory';
import { upgradeHistoryFragments, mapUpgradeHistoryResponse } from '../upgrade/useUpgradeHistory';
import { stakeHistoryFragments, mapStakeHistoryResponse } from '../stake/useStakeHistory';
import { rewardsHistoryFragments, mapRewardsHistoryResponse } from '../rewards/useAllRewardsUserHistory';
import { stusdsHistoryFragments, mapStusdsHistoryResponse } from '../stusds/useStUsdsHistory';
import { susdtHistoryFragments, mapSusdtHistoryResponse } from '../vaults/spark/useSusdtVaultHistory';
import { useAvailableTokenRewardContracts } from '../rewards/useAvailableTokenRewardContracts';
import { RewardContract } from '../rewards/rewards';
import { historyPageBoundary, clampHistoryPage, HistoryPage } from './historyQueryHelpers';
import { CombinedHistoryItem } from './shared';
import { isTestnetId, chainId as chainIdMap } from '@/utils';

async function fetchEthereumIndexerHistoryPage(
  urlIndexer: string,
  chainId: number,
  address: string,
  rewardContracts: RewardContract[],
  beforeTimestamp?: number
): Promise<HistoryPage<CombinedHistoryItem>> {
  const owner = address.toLowerCase();
  const query = gql`
    {
      ${savingsHistoryFragments({ owner, chainId, beforeTimestamp })}
      ${upgradeHistoryFragments({ usr: owner, chainId, beforeTimestamp })}
      ${stakeHistoryFragments({ owner, chainId, beforeTimestamp })}
      ${rewardsHistoryFragments({ user: owner, rewardContracts, chainId, beforeTimestamp })}
      ${stusdsHistoryFragments({ owner, chainId, beforeTimestamp })}
      ${susdtHistoryFragments({ owner, chainId, beforeTimestamp })}
    }
  `;

  const response = (await request(urlIndexer, query)) as any;

  const items: CombinedHistoryItem[] = [
    ...mapSavingsHistoryResponse(response, chainId),
    ...mapUpgradeHistoryResponse(response, chainId),
    ...mapStakeHistoryResponse(response, chainId),
    ...(mapRewardsHistoryResponse(response, chainId) || []),
    ...mapStusdsHistoryResponse(response, chainId),
    ...mapSusdtHistoryResponse(response, chainId)
  ].sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());

  const nextCursor = historyPageBoundary(response);
  return { items: clampHistoryPage(items, nextCursor), nextCursor };
}

/**
 * Every mainnet history entity family — savings, upgrade, stake, rewards,
 * stUSDS (incl. Curve) and the sUSDT vault — fetched as ONE indexer document
 * per page instead of the historical one-request-per-family fan-out. Pages are
 * keyset-paginated on blockTimestamp (see historyQueryHelpers), so `data` is
 * complete and correctly interleaved down to `nextCursor`.
 */
export function useEthereumIndexerHistory({ enabled = true }: { enabled?: boolean } = {}) {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
  // Resolved from the mainnet-or-tenderly chain (not the wallet chain) so dev
  // mode keeps hitting the Tenderly indexer.
  const urlIndexer = getIndexerUrl(chainIdToUse) || '';
  const rewardContracts = useAvailableTokenRewardContracts(chainIdToUse);

  const { data, error, refetch, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      enabled: Boolean(urlIndexer && address) && enabled,
      staleTime: HISTORY_STALE_TIME,
      queryKey: ['ethereum-indexer-history', urlIndexer, address, chainIdToUse],
      initialPageParam: undefined as number | undefined,
      queryFn: ({ pageParam }) =>
        fetchEthereumIndexerHistoryPage(urlIndexer, chainIdToUse, address || '', rewardContracts, pageParam),
      getNextPageParam: lastPage => lastPage.nextCursor
    });

  // Pages are non-overlapping, each internally sorted desc and strictly older
  // than the previous one, so concatenation preserves global order.
  const items = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);
  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor;

  return {
    data: data ? items : undefined,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate: refetch,
    /** Completeness floor (seconds); undefined once history is fully loaded. */
    nextCursor,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage
  };
}
