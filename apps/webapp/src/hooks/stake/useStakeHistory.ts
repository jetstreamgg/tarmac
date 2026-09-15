import { ReadHook } from '../hooks';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { historyQueryArgs, secondsToDate } from '../shared/historyQueryHelpers';
import { PaginatedHistory } from '../shared/useHistoryPagination';
import { useIndexerFamilyHistory } from '../shared/useIndexerFamilyHistory';
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
    blockTimestamp: secondsToDate(e.blockTimestamp),
    transactionHash: e.transactionHash,
    module: ModuleEnum.STAKE,
    type: TransactionTypeEnum.STAKE_OPEN,
    chainId
  }));

  const selectVoteDelegates: StakeSelectDelegate[] = response.stakingSelectVoteDelegates.map(
    (e: StakeSelectDelegateResponse) => ({
      urnIndex: +e.index,
      delegate: e.voteDelegate?.address || '',
      blockTimestamp: secondsToDate(e.blockTimestamp),
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
      blockTimestamp: secondsToDate(e.blockTimestamp),
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
      blockTimestamp: secondsToDate(e.blockTimestamp),
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
      blockTimestamp: secondsToDate(e.blockTimestamp),
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
      blockTimestamp: secondsToDate(e.blockTimestamp),
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
      blockTimestamp: secondsToDate(e.blockTimestamp),
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
      blockTimestamp: secondsToDate(e.blockTimestamp),
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
      blockTimestamp: secondsToDate(e.blockTimestamp),
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
} = {}): ReadHook & PaginatedHistory & { data?: StakeHistory } {
  return useIndexerFamilyHistory<StakeHistory[number]>({
    indexerUrl,
    familyMainnet: true,
    queryKey: ({ urlIndexer, address, chainId }) => ['stake-history', urlIndexer, address, index, chainId],
    fragments: args => stakeHistoryFragments({ ...args, index }),
    mapPage: mapStakeHistoryResponse
  });
}
