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
import { useConnection, useChainId } from 'wagmi';
import { familyMainnetId } from '@/utils';

export function stakeHistoryFragments({
  owner,
  chainId,
  index,
  beforeTimestamp
}: {
  owner: string;
  chainId: number;
  index?: number;
  beforeTimestamp?: number;
}): string {
  const indexFilter = index !== undefined ? `, index: { _eq: "${index}" }` : '';
  const urnArgs = historyQueryArgs(
    `urn: { owner: { _eq: "${owner}" }${indexFilter} }, chainId: { _eq: ${chainId} }`,
    beforeTimestamp
  );
  const ownerArgs = historyQueryArgs(
    `owner: { _eq: "${owner}" }${indexFilter}, chainId: { _eq: ${chainId} }`,
    beforeTimestamp
  );
  return `
      stakingOpens: StakingOpen${ownerArgs} {
        index
        blockTimestamp
        transactionHash
      }
      stakingSelectVoteDelegates: StakingSelectVoteDelegate${urnArgs} {
        index
        voteDelegate {
          address
        }
        blockTimestamp
        transactionHash
      }
      stakingSelectRewards: StakingSelectReward${urnArgs} {
        index
        reward {
          address
        }
        blockTimestamp
        transactionHash
      }
      stakingLocks: StakingLock${urnArgs} {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingFrees: StakingFree${urnArgs} {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingDraws: StakingDraw${urnArgs} {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingWipes: StakingWipe${urnArgs} {
        index
        wad
        blockTimestamp
        transactionHash
      }
      stakingGetRewards: StakingGetReward${urnArgs} {
        index
        reward
        amt
        blockTimestamp
        transactionHash
      }
      stakingOnKicks: StakingOnKick${urnArgs} {
        wad
        blockTimestamp
        transactionHash
        urn {
          address
        }
      }
  `;
}

export function mapStakeHistoryResponse(response: any, chainId: number): StakeHistory {
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

async function fetchStakeHistoryPage(
  urlIndexer: string,
  chainId: number,
  address?: string,
  index?: number,
  beforeTimestamp?: number
): Promise<HistoryPage<StakeHistory[number]>> {
  if (!address) return { items: [], nextCursor: undefined };
  const query = gql`
    {
      ${stakeHistoryFragments({ owner: address.toLowerCase(), chainId, index, beforeTimestamp })}
    }
  `;
  const response = (await request(urlIndexer, query)) as any;
  const nextCursor = historyPageBoundary(response);
  return { items: clampHistoryPage(mapStakeHistoryResponse(response, chainId), nextCursor), nextCursor };
}

export function useStakeHistory({
  indexerUrl,
  index
}: {
  indexerUrl?: string;
  index?: number;
} = {}): ReadHook & PaginatedHistory & { data?: StakeHistory } {
  const { address } = useConnection();
  const currentChainId = useChainId();
  const urlIndexer = indexerUrl ? indexerUrl : getIndexerUrl(currentChainId) || '';
  const chainIdToUse = familyMainnetId(currentChainId);

  const { data, isLoading, error, mutate, nextCursor, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useHistoryPagination({
      enabled: Boolean(urlIndexer),
      queryKey: ['stake-history', urlIndexer, address, index, chainIdToUse],
      fetchPage: beforeTimestamp =>
        fetchStakeHistoryPage(urlIndexer, chainIdToUse, address, index, beforeTimestamp)
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
