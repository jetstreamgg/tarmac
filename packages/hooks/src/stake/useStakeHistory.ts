import { request, gql } from 'graphql-request';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ModuleEnum, TransactionTypeEnum } from '../constants';
import { getSubgraphUrl } from '../helpers/getSubgraphUrl';
import {
  BaseStakeHistoryItem,
  StakeHistoryItemWithAmount,
  StakeSelectDelegate,
  StakeSelectReward,
  StakeClaimReward,
  StakeHistory,
  BaseStakeHistoryItemResponse,
  StakeSelectDelegateResponse,
  StakeSelectRewardResponse,
  StakeHistoryKick
} from './stakeModule';
import { useQuery } from '@tanstack/react-query';
import { useConnection, useChainId } from 'wagmi';
import { isTestnetId, chainId as chainIdMap } from '@jetstreamgg/sky-utils';

async function fetchStakeHistory(
  urlSubgraph: string,
  chainId: number,
  address?: string,
  index?: number
): Promise<StakeHistory | undefined> {
  if (!address) return [];
  const indexFilter = index !== undefined ? `, index: { _eq: "${index}" }` : '';
  const urnFilter = `{ urn: { owner: { _eq: "${address}" }${indexFilter} }, chainId: { _eq: ${chainId} } }`;
  const ownerFilter = `{ owner: { _eq: "${address}" }${indexFilter}, chainId: { _eq: ${chainId} } }`;
  const query = gql`
    {
      stakingOpens: StakingOpen(where: ${ownerFilter}) {
        index
        blockTimestamp
        transactionHash
      }
      stakingSelectVoteDelegates: StakingSelectVoteDelegate(where: ${urnFilter}) {
        index
        voteDelegate {
          address
        }
        blockTimestamp
        transactionHash
      }
      stakingSelectRewards: StakingSelectReward(where: ${urnFilter}) {
        index
        reward {
          address
        }
        blockTimestamp
        transactionHash
      }
      stakingLocks: StakingLock(where: ${urnFilter}) {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingFrees: StakingFree(where: ${urnFilter}) {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingDraws: StakingDraw(where: ${urnFilter}) {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingWipes: StakingWipe(where: ${urnFilter}) {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingGetRewards: StakingGetReward(where: ${urnFilter}) {
        index
        reward
        amt
        blockTimestamp
        transactionHash
      }
      stakingOnKicks: StakingOnKick(where: ${urnFilter}) {
        wad
        blockTimestamp
        transactionHash
        urn {
          address
        }
      }
    }
  `;

  const response = (await request(urlSubgraph, query)) as any;

  const opens: BaseStakeHistoryItem[] = response.stakingOpens.map((e: BaseStakeHistoryItemResponse) => ({
    urnIndex: +e.index,
    blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
    transactionHash: e.transactionHash,
    module: ModuleEnum.STAKE,
    type: TransactionTypeEnum.STAKE_OPEN,
    chainId
  }));

  const selectVoteDelegates: StakeSelectDelegate[] = response.stakingSelectVoteDelegates.map(
    (e: StakeSelectDelegateResponse) => ({
      urnIndex: +e.index,
      delegate: e.voteDelegate?.address || '',
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.STAKE_SELECT_DELEGATE,
      chainId
    })
  );

  const selectRewards: StakeSelectReward[] = response.stakingSelectRewards.map(
    (e: StakeSelectRewardResponse) => ({
      urnIndex: +e.index,
      rewardContract: e.reward?.address || '',
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.STAKE_SELECT_REWARD,
      chainId
    })
  );

  const stakes: StakeHistoryItemWithAmount[] = response.stakingLocks.map(
    (e: BaseStakeHistoryItemResponse & { wad: string }) => ({
      urnIndex: +e.index,
      amount: BigInt(e.wad),
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.STAKE,
      chainId
    })
  );

  const unstakes: StakeHistoryItemWithAmount[] = response.stakingFrees.map(
    (e: BaseStakeHistoryItemResponse & { wad: string }) => ({
      urnIndex: +e.index,
      amount: BigInt(e.wad),
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.UNSTAKE,
      chainId
    })
  );

  const borrows: StakeHistoryItemWithAmount[] = response.stakingDraws.map(
    (e: BaseStakeHistoryItemResponse & { wad: string }) => ({
      urnIndex: +e.index,
      amount: BigInt(e.wad),
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.STAKE_BORROW,
      chainId
    })
  );

  const repays: StakeHistoryItemWithAmount[] = response.stakingWipes.map(
    (e: BaseStakeHistoryItemResponse & { wad: string }) => ({
      urnIndex: +e.index,
      amount: BigInt(e.wad),
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.STAKE_REPAY,
      chainId
    })
  );

  const rewards: StakeClaimReward[] = response.stakingGetRewards.map(
    (e: BaseStakeHistoryItemResponse & { reward: string; amt: string }) => ({
      urnIndex: +e.index,
      rewardContract: e.reward,
      amount: BigInt(e.amt),
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.STAKE_REWARD,
      chainId
    })
  );

  const kicks: StakeHistoryKick[] = response.stakingOnKicks.map(
    (e: BaseStakeHistoryItemResponse & { wad: string; urn: { address: string } }) => ({
      amount: BigInt(e.wad),
      urnAddress: e.urn.address,
      blockTimestamp: new Date(parseInt(e.blockTimestamp) * 1000),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.UNSTAKE_KICK,
      chainId
    })
  );

  const combined = [
    ...opens,
    ...selectVoteDelegates,
    ...selectRewards,
    ...stakes,
    ...unstakes,
    ...borrows,
    ...repays,
    ...rewards,
    ...kicks
  ];
  return combined.sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

export function useStakeHistory({
  subgraphUrl,
  index
}: {
  subgraphUrl?: string;
  index?: number;
} = {}): ReadHook & { data?: StakeHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlSubgraph = subgraphUrl ? subgraphUrl : getSubgraphUrl() || '';
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlSubgraph),
    queryKey: ['stake-history', urlSubgraph, address, index, chainIdToUse],
    queryFn: () => fetchStakeHistory(urlSubgraph, chainIdToUse, address, index)
  });

  return {
    data,
    isLoading: !data && isLoading,
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
