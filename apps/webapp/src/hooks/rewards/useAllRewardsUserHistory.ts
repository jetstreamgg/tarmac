import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import {
  TRUST_LEVELS,
  TrustLevelEnum,
  ModuleEnum,
  TransactionTypeEnum,
  HISTORY_QUERY_LIMIT,
  HISTORY_STALE_TIME
} from '../constants';
import { getIndexerUrl } from '../helpers/getIndexerUrl';
import { useQuery } from '@tanstack/react-query';
import { RewardUserHistoryItem, AllRewardsUserHistoryResponse, RewardContract } from './rewards';
import { useAvailableTokenRewardContracts } from './useAvailableTokenRewardContracts';
import { useConnection, useChainId } from 'wagmi';
import { isTestnetId, chainId as chainIdMap } from '@/utils';

async function fetchAllRewardsUserHistory(
  urlIndexer: string,
  userAddress: string,
  rewardContracts: RewardContract[],
  chainId: number
): Promise<RewardUserHistoryItem[] | undefined> {
  const rewardContractAddresses = rewardContracts.map(f => `"${chainId}-${f.contractAddress.toLowerCase()}"`);
  const userFilter = `where: { user: { _eq: "${userAddress.toLowerCase()}" } }, order_by: { blockTimestamp: desc }, limit: ${HISTORY_QUERY_LIMIT}`;

  const query = gql`
    {
      rewards: Reward(where: { id: { _in: [${rewardContractAddresses}] }, chainId: { _eq: ${chainId} } }) {
        address
        supplyInstances(${userFilter}) {
          blockTimestamp
          transactionHash
          amount
        }
        withdrawals(${userFilter}) {
          blockTimestamp
          transactionHash
          amount
        }
        rewardClaims(${userFilter}) {
          blockTimestamp
          transactionHash
          amount
        }
      }
    }
  `;

  const response = (await request(urlIndexer, query)) as AllRewardsUserHistoryResponse;

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
