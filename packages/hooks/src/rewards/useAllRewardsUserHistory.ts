import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useQuery } from '@tanstack/react-query';
import { RewardUserHistoryItem, AllRewardsUserHistoryResponse, RewardContract } from './rewards';
import { useAvailableTokenRewardContracts } from './useAvailableTokenRewardContracts';
import { useConnection, useChainId } from 'wagmi';
import { isTestnetId, chainId as chainIdMap } from '@jetstreamgg/sky-utils';

async function fetchAllRewardsUserHistory(
  urlSubgraph: string,
  userAddress: string,
  rewardContracts: RewardContract[],
  chainId: number
): Promise<RewardUserHistoryItem[] | undefined> {
  const rewardContractAddresses = rewardContracts.map(f => `"${f.contractAddress}"`);

  const query = gql`
  {
    rewards(where: {id_in: [${rewardContractAddresses}]}) {
      id
      supplyInstances(where: {user: "${userAddress}"}) {
        blockTimestamp,
        transactionHash
        amount
      }
      withdrawals(where: {user: "${userAddress}"})  { 
        blockTimestamp,
        transactionHash
        amount
      }
      rewardClaims(where: {user: "${userAddress}"}) {
        blockTimestamp
        transactionHash
        amount
      }
    }
  }
`;

  const response = (await request(urlSubgraph, query)) as AllRewardsUserHistoryResponse;

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
      rewardContractAddress: f.id,
      chainId
    }));
    const withdrawals = f.withdrawals.map(e => ({
      blockTimestamp: new Date(parseInt(e.blockTimestamp, 10) * 1000),
      transactionHash: e.transactionHash,
      amount: BigInt(-e.amount), //negative for withdrawals
      rewardsClaim: false,
      module: ModuleEnum.REWARDS,
      type: TransactionTypeEnum.WITHDRAW,
      rewardContractAddress: f.id,
      chainId
    }));
    const rewardClaims = f.rewardClaims.map(e => ({
      blockTimestamp: new Date(parseInt(e.blockTimestamp, 10) * 1000),
      transactionHash: e.transactionHash,
      amount: BigInt(e.amount),
      rewardsClaim: true,
      module: ModuleEnum.REWARDS,
      type: TransactionTypeEnum.REWARD,
      rewardContractAddress: f.id,
      chainId
    }));

    const allParsed = [...supplyInstances, ...withdrawals, ...rewardClaims];
    const sorted = allParsed.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());

    return sorted;
  });

  return allRewardsHistoryItems.flat();
}

export function useAllRewardsUserHistory({
  subgraphUrl
}: {
  subgraphUrl?: string;
} = {}): ReadHook & { data?: RewardUserHistoryItem[] } {
  const { address: userAddress } = useConnection();
  const currentChainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(currentChainId) || '';
  //this hook is only used for mainnet, update this if this ever changes
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;
  const rewardContracts = useAvailableTokenRewardContracts(chainIdToUse);
  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph && userAddress),
    queryKey: ['all-rewards-user-history', urlSubgraph, userAddress, chainIdToUse],
    queryFn: () => fetchAllRewardsUserHistory(urlSubgraph, userAddress || '', rewardContracts, chainIdToUse)
  });

  return {
    data,
    isLoading,
    error: error as Error,
    mutate,
    dataSources: [
      {
        title: 'Sky Ecosystem subgraph',
        href: urlSubgraph,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
