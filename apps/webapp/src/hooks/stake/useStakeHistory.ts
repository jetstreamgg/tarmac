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
import { isTestnetId, chainId as chainIdMap } from '@/utils';

async function fetchStakeHistory(
  urlIndexer: string,
  chainId: number,
  address?: string,
  index?: number
): Promise<StakeHistory | undefined> {
  if (!address) return [];
  const owner = address.toLowerCase();
  const indexFilter = index !== undefined ? `, index: { _eq: "${index}" }` : '';
  const urnFilter = `where: { urn: { owner: { _eq: "${owner}" }${indexFilter} }, chainId: { _eq: ${chainId} } }, order_by: { blockTimestamp: desc }`;
  const ownerFilter = `where: { owner: { _eq: "${owner}" }${indexFilter}, chainId: { _eq: ${chainId} } }, order_by: { blockTimestamp: desc }`;
  const query = gql`
    {
      stakingOpens: StakingOpen(${ownerFilter}) {
        index
        blockTimestamp
        transactionHash
      }
      stakingSelectVoteDelegates: StakingSelectVoteDelegate(${urnFilter}) {
        index
        voteDelegate {
          address
        }
        blockTimestamp
        transactionHash
      }
      stakingSelectRewards: StakingSelectReward(${urnFilter}) {
        index
        reward {
          address
        }
        blockTimestamp
        transactionHash
      }
      stakingLocks: StakingLock(${urnFilter}) {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingFrees: StakingFree(${urnFilter}) {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingDraws: StakingDraw(${urnFilter}) {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingWipes: StakingWipe(${urnFilter}) {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingGetRewards: StakingGetReward(${urnFilter}) {
        index
        reward
        amt
        blockTimestamp
        transactionHash
      }
      stakingOnKicks: StakingOnKick(${urnFilter}) {
        wad
        blockTimestamp
        transactionHash
        urn {
          address
        }
      }
    }
  `;

  const response = (await request(urlIndexer, query)) as any;

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
  indexerUrl,
  index
}: {
  indexerUrl?: string;
  index?: number;
} = {}): ReadHook & { data?: StakeHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(currentChainId) || '';
  const chainIdToUse = isTestnetId(currentChainId) ? chainIdMap.tenderly : chainIdMap.mainnet;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    enabled: Boolean(urlIndexer),
    staleTime: HISTORY_STALE_TIME,
    queryKey: ['stake-history', urlIndexer, address, index, chainIdToUse],
    queryFn: () => fetchStakeHistory(urlIndexer, chainIdToUse, address, index)
  });

  return {
    data,
    isLoading: !data && isLoading,
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
