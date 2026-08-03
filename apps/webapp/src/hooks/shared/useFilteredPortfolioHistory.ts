import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { ModuleEnum } from '../constants';
import { useAllNetworksCombinedHistory } from './useAllNetworksCombinedHistory';
import { useEthereumCombinedHistory } from './useEthereumCombinedHistory';
import { useL2CombinedHistory } from './useL2CombinedHistory';
import { useHistoryFamilyQuery, HistoryFamily } from './useHistoryFamilyQuery';
import { L2_HISTORY_CHAIN_IDS } from './useL2sIndexerHistory';
import { useCowswapTradeHistory } from '../trade/useCowswapTradeHistory';
import { useMorphoVaultHistory } from '../morpho';
import { usePendleCombinedHistory } from '../pendle/usePendleCombinedHistory';
import { clampHistoryPage } from './historyQueryHelpers';
import { CombinedHistoryItem } from './shared';
import { isTestnetId, chainId as chainIdMap, TRADE_CUTOFF_DATES } from '@/utils';

const FAMILY_BY_MODULE: Partial<Record<ModuleEnum, HistoryFamily>> = {
  [ModuleEnum.SAVINGS]: 'savings',
  [ModuleEnum.UPGRADE]: 'upgrade',
  [ModuleEnum.STAKE]: 'stake',
  [ModuleEnum.REWARDS]: 'rewards',
  [ModuleEnum.STUSDS]: 'stusds',
  [ModuleEnum.SUSDT]: 'susdt',
  [ModuleEnum.TRADE]: 'psmTrades'
};

export type FilteredPortfolioHistory = {
  data: CombinedHistoryItem[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
};

const INERT_PAGINATION = {
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: () => {}
};

/**
 * History source for the portfolio Transactions filters. Unfiltered, this is
 * the 2-document all-networks aggregate; with a product and/or network filter
 * active it switches to a query scoped to that selection, so a category that
 * is sparse in recent history still paginates through its own full past
 * instead of showing only whatever survives the aggregate's per-page clamp.
 * Filter-scoped queries only fire when their filter is selected, and the
 * always-on sources (aggregate, CoW/Morpho/Pendle) are shared with the
 * aggregate's own instances through the react-query cache.
 */
export function useFilteredPortfolioHistory({
  product,
  network
}: {
  product?: ModuleEnum;
  network?: number;
}): FilteredPortfolioHistory {
  const currentChainId = useChainId();
  const mainnetChainId = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
  const isMainnetNetwork = network === mainnetChainId;
  const isL2Network = network !== undefined && L2_HISTORY_CHAIN_IDS.includes(network);
  const family = product !== undefined ? FAMILY_BY_MODULE[product] : undefined;

  const aggregate = useAllNetworksCombinedHistory();
  const ethereumCombined = useEthereumCombinedHistory();
  const l2Combined = useL2CombinedHistory(isL2Network ? network : chainIdMap.base, {
    enabled: product === undefined && isL2Network
  });
  const familyQuery = useHistoryFamilyQuery({
    family: family ?? 'savings',
    chainId: network,
    enabled: family !== undefined
  });

  // The CoW side of the trade family (mainnet + post-cutoff hybrid chains).
  const tradeSelected = product === ModuleEnum.TRADE;
  const mainnetCow = useCowswapTradeHistory({
    chainId: 1,
    enabled: tradeSelected && (network === undefined || isMainnetNetwork)
  });
  const baseCow = useCowswapTradeHistory({
    chainId: chainIdMap.base,
    enabled: tradeSelected && (network === undefined || network === chainIdMap.base)
  });
  const arbitrumCow = useCowswapTradeHistory({
    chainId: chainIdMap.arbitrum,
    enabled: tradeSelected && (network === undefined || network === chainIdMap.arbitrum)
  });

  const morphoHistory = useMorphoVaultHistory();
  const pendleHistory = usePendleCombinedHistory();

  const tradeData = useMemo(() => {
    const cowItems: CombinedHistoryItem[] = [
      ...(mainnetCow.data || []),
      ...(baseCow.data || []).filter(trade => trade.blockTimestamp >= TRADE_CUTOFF_DATES[chainIdMap.base]),
      ...(arbitrumCow.data || []).filter(
        trade => trade.blockTimestamp >= TRADE_CUTOFF_DATES[chainIdMap.arbitrum]
      )
    ];
    return [...(familyQuery.data || []), ...clampHistoryPage(cowItems, familyQuery.nextCursor)].sort(
      (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
    );
  }, [familyQuery.data, familyQuery.nextCursor, mainnetCow.data, baseCow.data, arbitrumCow.data]);

  // No product filter → the network-scoped (or full) aggregates.
  if (product === undefined) {
    if (isMainnetNetwork) return ethereumCombined;
    if (isL2Network) return l2Combined;
    return aggregate;
  }

  switch (product) {
    case ModuleEnum.MORPHO:
      return {
        data: morphoHistory.data || [],
        isLoading: morphoHistory.isLoading,
        error: morphoHistory.error,
        mutate: morphoHistory.mutate,
        ...INERT_PAGINATION
      };
    case ModuleEnum.PENDLE:
      return {
        data: pendleHistory.data || [],
        isLoading: pendleHistory.isLoading,
        error: pendleHistory.error,
        mutate: pendleHistory.mutate,
        ...INERT_PAGINATION
      };
    case ModuleEnum.TRADE:
      return {
        data: tradeData,
        isLoading:
          familyQuery.isLoading || mainnetCow.isLoading || baseCow.isLoading || arbitrumCow.isLoading,
        error: familyQuery.error || mainnetCow.error || baseCow.error || arbitrumCow.error,
        mutate: () => {
          familyQuery.mutate();
          mainnetCow.mutate();
          baseCow.mutate();
          arbitrumCow.mutate();
        },
        hasNextPage: Boolean(familyQuery.hasNextPage),
        isFetchingNextPage: familyQuery.isFetchingNextPage,
        fetchNextPage: familyQuery.fetchNextPage
      };
    default:
      return {
        data: familyQuery.data || [],
        isLoading: familyQuery.isLoading,
        error: familyQuery.error,
        mutate: familyQuery.mutate,
        hasNextPage: Boolean(familyQuery.hasNextPage),
        isFetchingNextPage: familyQuery.isFetchingNextPage,
        fetchNextPage: familyQuery.fetchNextPage
      };
  }
}
