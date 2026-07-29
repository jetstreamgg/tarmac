import { useMemo } from 'react';
import { request } from 'graphql-request';
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
import { l2SavingsHistoryFragments, mapL2SavingsRows } from '../psm/useL2SavingsHistory';
import { psmTradeFragment, mapPsmTradeRows } from '../psm/usePsmTradeHistory';
import { useAvailableTokenRewardContracts } from '../rewards/useAvailableTokenRewardContracts';
import { RewardContract } from '../rewards/rewards';
import { useTokenAddressMap } from '../tokens/useTokenAddressMap';
import { historyPageBoundary, clampHistoryPage, HistoryPage } from './historyQueryHelpers';
import { L2_HISTORY_CHAIN_IDS, tradeCutoffTimestamp } from './useL2sIndexerHistory';
import { CombinedHistoryItem } from './shared';
import { isTestnetId, chainId as chainIdMap } from '@/utils';

/**
 * One Envio-backed history family, queried on its own. Used by the filtered
 * portfolio views: a family scoped to itself paginates at its own density, so
 * a category that is sparse in recent history still surfaces its full past
 * (the merged all-families documents clamp every page at the densest family's
 * frontier, hiding a sparse family's older rows until many pages load).
 */
export type HistoryFamily = 'savings' | 'upgrade' | 'stake' | 'rewards' | 'stusds' | 'susdt' | 'psmTrades';

// Families whose entities exist (only) on mainnet; savings additionally has
// the L2 sUSDS-swap leg, and psmTrades is L2-only.
const MAINNET_FAMILIES: HistoryFamily[] = ['savings', 'upgrade', 'stake', 'rewards', 'stusds', 'susdt'];
const L2_FAMILIES: HistoryFamily[] = ['savings', 'psmTrades'];

function mainnetFamilyFragments(
  family: HistoryFamily,
  owner: string,
  chainId: number,
  rewardContracts: RewardContract[],
  beforeTimestamp?: number
): string {
  switch (family) {
    case 'savings':
      return savingsHistoryFragments({ owner, chainId, beforeTimestamp });
    case 'upgrade':
      return upgradeHistoryFragments({ usr: owner, chainId, beforeTimestamp });
    case 'stake':
      return stakeHistoryFragments({ owner, chainId, beforeTimestamp });
    case 'rewards':
      return rewardsHistoryFragments({ user: owner, rewardContracts, chainId, beforeTimestamp });
    case 'stusds':
      return stusdsHistoryFragments({ owner, chainId, beforeTimestamp });
    case 'susdt':
      return susdtHistoryFragments({ owner, chainId, beforeTimestamp });
    default:
      return '';
  }
}

function mapMainnetFamilyResponse(
  family: HistoryFamily,
  response: any,
  chainId: number
): CombinedHistoryItem[] {
  switch (family) {
    case 'savings':
      return mapSavingsHistoryResponse(response, chainId);
    case 'upgrade':
      return mapUpgradeHistoryResponse(response, chainId);
    case 'stake':
      return mapStakeHistoryResponse(response, chainId);
    case 'rewards':
      return mapRewardsHistoryResponse(response, chainId) || [];
    case 'stusds':
      return mapStusdsHistoryResponse(response, chainId);
    case 'susdt':
      return mapSusdtHistoryResponse(response, chainId);
    default:
      return [];
  }
}

type FamilyPageContext = {
  family: HistoryFamily;
  owner: string;
  mainnetUrl: string;
  l2Url: string;
  mainnetChainId: number;
  includeMainnet: boolean;
  l2ChainIds: number[];
  rewardContracts: RewardContract[];
  tokenAddressMaps: Record<number, Record<string, any>>;
};

async function fetchHistoryFamilyPage(
  ctx: FamilyPageContext,
  beforeTimestamp?: number
): Promise<HistoryPage<CombinedHistoryItem>> {
  const requests: Array<{ url: string; doc: string; map: (resp: any) => CombinedHistoryItem[] }> = [];

  if (ctx.includeMainnet) {
    requests.push({
      url: ctx.mainnetUrl,
      doc: `{ ${mainnetFamilyFragments(ctx.family, ctx.owner, ctx.mainnetChainId, ctx.rewardContracts, beforeTimestamp)} }`,
      map: resp => mapMainnetFamilyResponse(ctx.family, resp, ctx.mainnetChainId)
    });
  }

  if (ctx.l2ChainIds.length > 0) {
    const fragments = ctx.l2ChainIds
      .map(chainId =>
        ctx.family === 'savings'
          ? l2SavingsHistoryFragments({
              wallet: ctx.owner,
              chainId,
              aliasSuffix: `_${chainId}`,
              beforeTimestamp
            })
          : psmTradeFragment({
              alias: `swaps_${chainId}`,
              wallet: ctx.owner,
              chainId,
              excludeSUsds: true,
              maxBlockTimestamp: tradeCutoffTimestamp(chainId),
              beforeTimestamp
            })
      )
      .join('\n');
    requests.push({
      url: ctx.l2Url,
      doc: `{ ${fragments} }`,
      map: resp =>
        ctx.l2ChainIds.flatMap<CombinedHistoryItem>(chainId =>
          ctx.family === 'savings'
            ? mapL2SavingsRows(
                resp[`usdsIn_${chainId}`],
                resp[`usdsOut_${chainId}`],
                chainId,
                ctx.tokenAddressMaps[chainId]
              )
            : mapPsmTradeRows(resp[`swaps_${chainId}`], chainId, ctx.tokenAddressMaps[chainId])
        )
    });
  }

  // The mainnet and L2 legs may live in different databases in dev mode, so a
  // page can be up to two requests; the boundary spans both responses.
  const responses = await Promise.all(
    requests.map(async ({ url, doc, map }) => {
      const resp = await request(url, doc);
      return { resp, map };
    })
  );

  const items = responses
    .flatMap(({ resp, map }) => map(resp))
    .sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
  const boundaries = responses
    .map(({ resp }) => historyPageBoundary(resp))
    .filter((b): b is number => b !== undefined);
  const nextCursor = boundaries.length > 0 ? Math.max(...boundaries) : undefined;

  return { items: clampHistoryPage(items, nextCursor), nextCursor };
}

export function useHistoryFamilyQuery({
  family,
  chainId,
  enabled = true
}: {
  family: HistoryFamily;
  /** Narrow the family to one network; omit for all networks it exists on. */
  chainId?: number;
  enabled?: boolean;
}) {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const mainnetChainId = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
  const includeMainnet =
    MAINNET_FAMILIES.includes(family) && (chainId === undefined || chainId === mainnetChainId);
  const l2ChainIds = L2_FAMILIES.includes(family)
    ? chainId === undefined
      ? L2_HISTORY_CHAIN_IDS
      : L2_HISTORY_CHAIN_IDS.filter(id => id === chainId)
    : [];
  // e.g. a mainnet-only family narrowed to an L2: genuinely no data, no fetch.
  const hasScope = includeMainnet || l2ChainIds.length > 0;

  const rewardContracts = useAvailableTokenRewardContracts(mainnetChainId);
  const baseTokens = useTokenAddressMap(chainIdMap.base);
  const arbitrumTokens = useTokenAddressMap(chainIdMap.arbitrum);
  const optimismTokens = useTokenAddressMap(chainIdMap.optimism);
  const unichainTokens = useTokenAddressMap(chainIdMap.unichain);
  const tokenAddressMaps = useMemo(
    () => ({
      [chainIdMap.base]: baseTokens,
      [chainIdMap.arbitrum]: arbitrumTokens,
      [chainIdMap.optimism]: optimismTokens,
      [chainIdMap.unichain]: unichainTokens
    }),
    [baseTokens, arbitrumTokens, optimismTokens, unichainTokens]
  );

  const { data, error, refetch, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      enabled: Boolean(address) && enabled && hasScope,
      staleTime: HISTORY_STALE_TIME,
      queryKey: ['history-family', family, chainId ?? 'all', address, mainnetChainId],
      initialPageParam: undefined as number | undefined,
      queryFn: ({ pageParam }) =>
        fetchHistoryFamilyPage(
          {
            family,
            owner: (address || '').toLowerCase(),
            mainnetUrl: getIndexerUrl(mainnetChainId) || '',
            l2Url: getIndexerUrl(chainIdMap.base) || '',
            mainnetChainId,
            includeMainnet,
            l2ChainIds,
            rewardContracts,
            tokenAddressMaps
          },
          pageParam
        ),
      getNextPageParam: lastPage => lastPage.nextCursor
    });

  const items = useMemo(() => data?.pages.flatMap(page => page.items) ?? [], [data]);
  const nextCursor = data?.pages[data.pages.length - 1]?.nextCursor;

  return {
    // Out-of-scope combinations (mainnet-only family on an L2) are just empty.
    data: hasScope ? (data ? items : undefined) : [],
    isLoading: hasScope && !data && isLoading,
    error: error as Error | null,
    mutate: refetch,
    /** Completeness floor (seconds); undefined once history is fully loaded. */
    nextCursor,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage
  };
}
