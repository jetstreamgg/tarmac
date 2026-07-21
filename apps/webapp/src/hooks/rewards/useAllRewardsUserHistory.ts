import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import {
  TRUST_LEVELS,
  TrustLevelEnum,
  ModuleEnum,
  TransactionTypeEnum,
  HISTORY_STALE_TIME
} from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { historyQueryArgs } from '../shared/historyQueryHelpers';
import { useQuery } from '@tanstack/react-query';
import { RewardUserHistoryItem, AllRewardsUserHistoryResponse, RewardContract } from './rewards';
import { useAvailableTokenRewardContracts } from './useAvailableTokenRewardContracts';
import { useConnection, useChainId } from 'wagmi';
import { isTestnetId, chainId as chainIdMap } from '@/utils';

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

async function fetchAllRewardsUserHistory(
  urlIndexer: string,
  userAddress: string,
  rewardContracts: RewardContract[],
  chainId: number
): Promise<RewardUserHistoryItem[] | undefined> {
  const query = gql`
    {
      ${rewardsHistoryFragments({ user: userAddress.toLowerCase(), rewardContracts, chainId })}
    }
  `;
  const response = (await request(urlIndexer, query)) as AllRewardsUserHistoryResponse;
  return mapRewardsHistoryResponse(response, chainId);
}

export function useAllRewardsUserHistory({
  indexerUrl
}: {
  indexerUrl?: string;
} = {}): ReadHook & { data?: RewardUserHistoryItem[] } {
  const { address: userAddress } = useConnection();
  const currentChainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(currentChainId) || '';
  //this hook is only used for mainnet, update this if this ever changes
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
  const rewardContracts = useAvailableTokenRewardContracts(chainIdToUse);
  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer && userAddress),
    staleTime: HISTORY_STALE_TIME,
    queryKey: ['all-rewards-user-history', urlIndexer, userAddress, chainIdToUse],
    queryFn: () => fetchAllRewardsUserHistory(urlIndexer, userAddress || '', rewardContracts, chainIdToUse)
  });

  return {
    data,
    isLoading,
    error: error as Error,
    mutate,
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
