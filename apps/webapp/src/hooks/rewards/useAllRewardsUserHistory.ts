import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import {
  historyQueryArgs,
  historyPageBoundary,
  clampHistoryPage,
  HistoryPage
} from '../shared/historyQueryHelpers';
import { useHistoryPagination, PaginatedHistory } from '../shared/useHistoryPagination';
import { RewardUserHistoryItem, AllRewardsUserHistoryResponse, RewardContract } from './rewards';
import { useAvailableTokenRewardContracts } from './useAvailableTokenRewardContracts';
import { useConnection, useChainId } from 'wagmi';
import { familyMainnetId } from '@/utils';

export function rewardsHistoryFragments({
  user,
  rewardContracts,
  chainId,
  beforeTimestamp
}: {
  user: string;
  rewardContracts: RewardContract[];
  chainId: number;
  beforeTimestamp?: number;
}): string {
  const rewardContractAddresses = rewardContracts.map(f => `"${chainId}-${f.contractAddress.toLowerCase()}"`);
  // historyQueryArgs wraps in parens for a top-level entity; nested lists take the same args.
  const userArgs = historyQueryArgs(`user: { _eq: "${user}" }`, beforeTimestamp);

  return `
      rewards: Reward(where: { id: { _in: [${rewardContractAddresses}] }, chainId: { _eq: ${chainId} } }) {
        address
        supplyInstances${userArgs} {
          blockTimestamp
          transactionHash
          amount
        }
        withdrawals${userArgs} {
          blockTimestamp
          transactionHash
          amount
        }
        rewardClaims${userArgs} {
          blockTimestamp
          transactionHash
          amount
        }
      }
  `;
}

export function mapRewardsHistoryResponse(
  response: AllRewardsUserHistoryResponse,
  chainId: number
): RewardUserHistoryItem[] | undefined {
  const rewardsData = response.rewards;

  if (!rewardsData) {
    return undefined;
  }

  const allRewardsHistoryItems = rewardsData.map(f => {
    const supplyInstances = f.supplyInstances.map(e => ({
      blockTimestamp: new Date(parseInt(e.blockTimestamp, 10) * 1000),
      transactionHash: e.transactionHash,
      amount: BigInt(e.amount),
      rewardsClaim: false,
      module: ModuleEnum.REWARDS,
      type: TransactionTypeEnum.SUPPLY,
      rewardContractAddress: f.address,
      chainId
    }));
    const withdrawals = f.withdrawals.map(e => ({
      blockTimestamp: new Date(parseInt(e.blockTimestamp, 10) * 1000),
      transactionHash: e.transactionHash,
      amount: BigInt(-e.amount), //negative for withdrawals
      rewardsClaim: false,
      module: ModuleEnum.REWARDS,
      type: TransactionTypeEnum.WITHDRAW,
      rewardContractAddress: f.address,
      chainId
    }));
    const rewardClaims = f.rewardClaims.map(e => ({
      blockTimestamp: new Date(parseInt(e.blockTimestamp, 10) * 1000),
      transactionHash: e.transactionHash,
      amount: BigInt(e.amount),
      rewardsClaim: true,
      module: ModuleEnum.REWARDS,
      type: TransactionTypeEnum.REWARD,
      rewardContractAddress: f.address,
      chainId
    }));

    const allParsed = [...supplyInstances, ...withdrawals, ...rewardClaims];
    const sorted = allParsed.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());

    return sorted;
  });

  return allRewardsHistoryItems.flat();
}

async function fetchAllRewardsUserHistoryPage(
  urlIndexer: string,
  userAddress: string,
  rewardContracts: RewardContract[],
  chainId: number,
  beforeTimestamp?: number
): Promise<HistoryPage<RewardUserHistoryItem>> {
  const query = gql`
    {
      ${rewardsHistoryFragments({ user: userAddress.toLowerCase(), rewardContracts, chainId, beforeTimestamp })}
    }
  `;
  const response = (await request(urlIndexer, query)) as AllRewardsUserHistoryResponse;
  // The mapper interleaves per-contract lists unsorted; sort so concatenated
  // pages stay globally ordered.
  const items = (mapRewardsHistoryResponse(response, chainId) ?? []).sort(
    (a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime()
  );
  const nextCursor = historyPageBoundary(response);
  return { items: clampHistoryPage(items, nextCursor), nextCursor };
}

export function useAllRewardsUserHistory({
  indexerUrl
}: {
  indexerUrl?: string;
} = {}): ReadHook & PaginatedHistory & { data?: RewardUserHistoryItem[] } {
  const { address: userAddress } = useConnection();
  const currentChainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(currentChainId) || '';
  //this hook is only used for mainnet, update this if this ever changes
  const chainIdToUse = familyMainnetId(currentChainId);
  const rewardContracts = useAvailableTokenRewardContracts(chainIdToUse);
  const { data, isLoading, error, mutate, nextCursor, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHistoryPagination({
      enabled: Boolean(urlIndexer && userAddress),
      queryKey: ['all-rewards-user-history', urlIndexer, userAddress, chainIdToUse],
      fetchPage: beforeTimestamp =>
        fetchAllRewardsUserHistoryPage(
          urlIndexer,
          userAddress || '',
          rewardContracts,
          chainIdToUse,
          beforeTimestamp
        )
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
    dataSources: [
      {
        title: 'Sky Ecosystem indexer',
        href: urlIndexer,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
