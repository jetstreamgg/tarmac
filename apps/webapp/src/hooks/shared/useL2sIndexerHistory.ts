import { useMemo } from 'react';
import { request, gql } from 'graphql-request';
import { useConnection } from 'wagmi';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { l2SavingsHistoryFragments, mapL2SavingsRows } from '../psm/useL2SavingsHistory';
import { psmTradeFragment, mapPsmTradeRows } from '../psm/usePsmTradeHistory';
import { useTokenAddressMap } from '../tokens/useTokenAddressMap';
import { historyPageBoundary, clampHistoryPage, HistoryPage } from './historyQueryHelpers';
import { CombinedHistoryItem } from './shared';
import { useHistoryPagination } from './useHistoryPagination';
import { chainId as chainIdMap, TRADE_CUTOFF_DATES } from '@/utils';

// The chains whose PSM `Swap` history feeds the all-networks views. All of
// them live in the indexer's single multichain database, so one document
// serves every chain; hybrid chains cap PSM trades at their CowSwap cutoff.
export const L2_HISTORY_CHAIN_IDS = [
  chainIdMap.base,
  chainIdMap.arbitrum,
  chainIdMap.optimism,
  chainIdMap.unichain
];

export function tradeCutoffTimestamp(chainId: number): number | undefined {
  const cutoff = TRADE_CUTOFF_DATES[chainId];
  return cutoff ? Math.floor(cutoff.getTime() / 1000) : undefined;
}

async function fetchL2sIndexerHistoryPage(
  urlIndexer: string,
  address: string,
  tokenAddressMaps: Record<number, Record<string, any>>,
  beforeTimestamp?: number
): Promise<HistoryPage<CombinedHistoryItem>> {
  const wallet = address.toLowerCase();
  const query = gql`
    {
      ${L2_HISTORY_CHAIN_IDS.map(
        chainId => `
          ${l2SavingsHistoryFragments({ wallet, chainId, aliasSuffix: `_${chainId}`, beforeTimestamp })}
          ${psmTradeFragment({
            alias: `swaps_${chainId}`,
            wallet,
            chainId,
            excludeSUsds: true,
            maxBlockTimestamp: tradeCutoffTimestamp(chainId),
            beforeTimestamp
          })}
        `
      ).join('\n')}
    }
  `;

  const response = (await request(urlIndexer, query)) as any;

  const items: CombinedHistoryItem[] = L2_HISTORY_CHAIN_IDS.flatMap(chainId => [
    ...mapL2SavingsRows(
      response[`usdsIn_${chainId}`],
      response[`usdsOut_${chainId}`],
      chainId,
      tokenAddressMaps[chainId]
    ),
    ...mapPsmTradeRows(response[`swaps_${chainId}`], chainId, tokenAddressMaps[chainId])
  ]).sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());

  const nextCursor = historyPageBoundary(response);
  return { items: clampHistoryPage(items, nextCursor), nextCursor };
}

/**
 * PSM savings + trade history for every L2 fetched as ONE indexer document per
 * page (formerly two requests per chain), keyset-paginated like
 * useEthereumIndexerHistory. Only the production indexer holds L2 data, so
 * this always targets it — even in Tenderly dev mode, matching the previous
 * per-chain hooks' behavior.
 */
export function useL2sIndexerHistory({ enabled = true }: { enabled?: boolean } = {}) {
  const { address } = useConnection();
  // Any production chain path resolves to the same multichain indexer.
  const urlIndexer = getIndexerUrl(chainIdMap.base) || '';

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

  return useHistoryPagination({
    enabled: Boolean(urlIndexer && address) && enabled,
    queryKey: ['l2s-indexer-history', urlIndexer, address, L2_HISTORY_CHAIN_IDS.join('-')],
    fetchPage: beforeTimestamp =>
      fetchL2sIndexerHistoryPage(urlIndexer, address || '', tokenAddressMaps, beforeTimestamp)
  });
}
