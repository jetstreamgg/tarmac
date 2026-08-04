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
 *
 * `products` is a list because one product in the UI can span several modules:
 * Morpho and sUSDT are both "Vault" (APP-443 item 21), and their history comes
 * from two different sources that have to be merged behind the one filter.
 */
export function useFilteredPortfolioHistory({
  products,
  network
}: {
  products?: ModuleEnum[];
  network?: number;
}): FilteredPortfolioHistory {
  const currentChainId = useChainId();
  const mainnetChainId = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
  const isMainnetNetwork = network === mainnetChainId;
  const isL2Network = network !== undefined && L2_HISTORY_CHAIN_IDS.includes(network);
  const isFiltered = products !== undefined && products.length > 0;
  const wants = (module: ModuleEnum) => isFiltered && products.includes(module);
  // At most one selected module is Envio-backed — the REST-backed ones (Morpho,
  // Pendle) have no family — so a group needs a single family document.
  const family = isFiltered ? products.map(module => FAMILY_BY_MODULE[module]).find(Boolean) : undefined;

  const aggregate = useAllNetworksCombinedHistory();
  const ethereumCombined = useEthereumCombinedHistory();
  const l2Combined = useL2CombinedHistory(isL2Network ? network : chainIdMap.base, {
    enabled: !isFiltered && isL2Network
  });
  const familyQuery = useHistoryFamilyQuery({
    family: family ?? 'savings',
    chainId: network,
    enabled: family !== undefined
  });

  // The CoW side of the trade family (mainnet + post-cutoff hybrid chains).
  const tradeSelected = wants(ModuleEnum.TRADE);
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

  // Every REST-backed source the selection asks for, held back to the family
  // document's completeness floor so rows never insert mid-list on the next
  // page. With no family document there is no floor and nothing is withheld.
  const morphoSelected = wants(ModuleEnum.MORPHO);
  const pendleSelected = wants(ModuleEnum.PENDLE);
  const restData = useMemo(() => {
    const items: CombinedHistoryItem[] = [];
    if (tradeSelected) {
      items.push(
        ...(mainnetCow.data || []),
        ...(baseCow.data || []).filter(trade => trade.blockTimestamp >= TRADE_CUTOFF_DATES[chainIdMap.base]),
        ...(arbitrumCow.data || []).filter(
          trade => trade.blockTimestamp >= TRADE_CUTOFF_DATES[chainIdMap.arbitrum]
        )
      );
    }
    if (morphoSelected) items.push(...(morphoHistory.data || []));
    if (pendleSelected) items.push(...(pendleHistory.data || []));
    return items;
  }, [
    tradeSelected,
    morphoSelected,
    pendleSelected,
    mainnetCow.data,
    baseCow.data,
    arbitrumCow.data,
    morphoHistory.data,
    pendleHistory.data
  ]);

  const filteredData = useMemo(
    () =>
      [
        ...(family !== undefined ? familyQuery.data || [] : []),
        ...clampHistoryPage(restData, family !== undefined ? familyQuery.nextCursor : undefined)
      ].sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()),
    [family, familyQuery.data, familyQuery.nextCursor, restData]
  );

  // No product filter → the network-scoped (or full) aggregates.
  if (!isFiltered) {
    if (isMainnetNetwork) return ethereumCombined;
    if (isL2Network) return l2Combined;
    return aggregate;
  }

  type SelectedSource = { isLoading: boolean; error: Error | null; mutate: () => void };
  const sources: SelectedSource[] = [];
  if (family !== undefined) sources.push(familyQuery);
  if (tradeSelected) sources.push(mainnetCow, baseCow, arbitrumCow);
  if (morphoSelected) sources.push(morphoHistory);
  if (pendleSelected) sources.push(pendleHistory);

  return {
    data: filteredData,
    isLoading: sources.some(source => source.isLoading),
    error: sources.map(source => source.error).find(Boolean) ?? null,
    mutate: () => sources.forEach(source => source.mutate()),
    // Only the family document paginates; the REST feeds arrive whole.
    ...(family !== undefined
      ? {
          hasNextPage: Boolean(familyQuery.hasNextPage),
          isFetchingNextPage: familyQuery.isFetchingNextPage,
          fetchNextPage: familyQuery.fetchNextPage
        }
      : INERT_PAGINATION)
  };
}
