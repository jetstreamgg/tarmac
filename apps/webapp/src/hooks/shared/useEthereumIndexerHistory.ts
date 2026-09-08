import { request, gql } from 'graphql-request';
import { useConnection, useChainId } from 'wagmi';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { savingsHistoryFragments, mapSavingsHistoryResponse } from '../savings/useEthereumSavingsHistory';
import { upgradeHistoryFragments, mapUpgradeHistoryResponse } from '../upgrade/useUpgradeHistory';
import { stakeHistoryFragments, mapStakeHistoryResponse } from '../stake/useStakeHistory';
import { rewardsHistoryFragments, mapRewardsHistoryResponse } from '../rewards/useAllRewardsUserHistory';
import { stusdsHistoryFragments, mapStusdsHistoryResponse } from '../stusds/useStUsdsHistory';
import { susdtHistoryFragments, mapSusdtHistoryResponse } from '../vaults/spark/useSusdtVaultHistory';
import { psmTradeFragment, mapPsmTradeRows } from '../psm/usePsmTradeHistory';
import { useAvailableTokenRewardContracts } from '../rewards/useAvailableTokenRewardContracts';
import { RewardContract } from '../rewards/rewards';
import { useTokenAddressMap } from '../tokens/useTokenAddressMap';
import { ModuleEnum } from '../constants';
import { historyPageBoundary, clampHistoryPage, HistoryPage } from './historyQueryHelpers';
import { useHistoryPagination } from './useHistoryPagination';
import { CombinedHistoryItem } from './shared';
import { familyMainnetId } from '@/utils';

/**
 * Drops the PSM swaps that are legs of another product's transaction. A USDC
 * savings supply on mainnet is a PSM `sellGem` plus a deposit in ONE
 * transaction (useBatchPsmSwapAndSavingsSupply), so its swap would otherwise
 * show up as a second, "Convert" row beside the savings row. Same-timestamp
 * rows always share a page (the clamp cuts on the timestamp), so the hash
 * check never misses across a page boundary.
 *
 * Combined-document path only: the per-family `psmTrades` query (the
 * portfolio's Convert filter) fetches swaps alone and has no sibling rows to
 * match against, so an embedded leg still lists there. The `Swap` entity
 * carries no origin field; the real fix is an indexer-side discriminator.
 */
export function dropEmbeddedSwaps(items: CombinedHistoryItem[]): CombinedHistoryItem[] {
  const otherHashes = new Set(
    items.filter(item => item.module !== ModuleEnum.TRADE).map(item => item.transactionHash.toLowerCase())
  );
  return items.filter(
    item => item.module !== ModuleEnum.TRADE || !otherHashes.has(item.transactionHash.toLowerCase())
  );
}

async function fetchEthereumIndexerHistoryPage(
  urlIndexer: string,
  chainId: number,
  address: string,
  rewardContracts: RewardContract[],
  tokenAddressMap: ReturnType<typeof useTokenAddressMap>,
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
      ${psmTradeFragment({ alias: 'swaps', wallet: owner, chainId, beforeTimestamp })}
    }
  `;

  const response = (await request(urlIndexer, query)) as any;

  const items: CombinedHistoryItem[] = dropEmbeddedSwaps([
    ...mapSavingsHistoryResponse(response, chainId),
    ...mapUpgradeHistoryResponse(response, chainId),
    ...mapStakeHistoryResponse(response, chainId),
    ...(mapRewardsHistoryResponse(response, chainId) || []),
    ...mapStusdsHistoryResponse(response, chainId),
    ...mapSusdtHistoryResponse(response, chainId),
    // The mainnet PSM (USDC ⇄ USDS conversions, APP-558) — indexed as the
    // same `Swap` entity the L2 PSM3 trades come from.
    ...mapPsmTradeRows(response.swaps ?? [], chainId, tokenAddressMap)
  ]).sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());

  const nextCursor = historyPageBoundary(response);
  return { items: clampHistoryPage(items, nextCursor), nextCursor };
}

/**
 * Every mainnet history entity family — savings, upgrade, stake, rewards,
 * stUSDS (incl. Curve), the sUSDT vault and the PSM conversions — fetched as ONE indexer document
 * per page instead of the historical one-request-per-family fan-out. Pages are
 * keyset-paginated on blockTimestamp (see historyQueryHelpers), so `data` is
 * complete and correctly interleaved down to `nextCursor`.
 */
export function useEthereumIndexerHistory({ enabled = true }: { enabled?: boolean } = {}) {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const chainIdToUse = familyMainnetId(currentChainId);
  // Resolved from the mainnet-or-tenderly chain (not the wallet chain) so dev
  // mode keeps hitting the Tenderly indexer.
  const urlIndexer = getIndexerUrl(chainIdToUse) || '';
  const rewardContracts = useAvailableTokenRewardContracts(chainIdToUse);
  const tokenAddressMap = useTokenAddressMap(chainIdToUse);

  return useHistoryPagination({
    enabled: Boolean(urlIndexer && address) && enabled,
    queryKey: ['ethereum-indexer-history', urlIndexer, address, chainIdToUse],
    fetchPage: beforeTimestamp =>
      fetchEthereumIndexerHistoryPage(
        urlIndexer,
        chainIdToUse,
        address || '',
        rewardContracts,
        tokenAddressMap,
        beforeTimestamp
      )
  });
}
