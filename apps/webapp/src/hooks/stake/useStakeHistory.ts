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
import { mapIndexerRows, safeBigInt } from '@/utils/indexerRows';

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
  const base = (e: BaseStakeHistoryItemResponse) => ({
    urnIndex: +e.index,
    blockTimestamp: secondsToDate(e.blockTimestamp),
    transactionHash: e.transactionHash,
    module: ModuleEnum.STAKE,
    chainId
  });

  const withAmount =
    (type: StakeHistoryItemWithAmount['type']) =>
    (e: BaseStakeHistoryItemResponse & { wad: string }): StakeHistoryItemWithAmount | undefined => {
      const amount = safeBigInt(e.wad);
      if (amount === undefined) return undefined;
      return { ...base(e), amount, type };
    };

  const opens = mapIndexerRows<BaseStakeHistoryItemResponse, BaseStakeHistoryItem>(
    response?.stakingOpens,
    e => ({
      ...base(e),
      type: TransactionTypeEnum.STAKE_OPEN
    })
  );

  const selectVoteDelegates = mapIndexerRows<StakeSelectDelegateResponse, StakeSelectDelegate>(
    response?.stakingSelectVoteDelegates,
    e => ({
      ...base(e),
      delegate: e.voteDelegate?.address || '',
      type: TransactionTypeEnum.STAKE_SELECT_DELEGATE
    })
  );

  const selectRewards = mapIndexerRows<StakeSelectRewardResponse, StakeSelectReward>(
    response?.stakingSelectRewards,
    e => ({
      ...base(e),
      rewardContract: e.reward?.address || '',
      type: TransactionTypeEnum.STAKE_SELECT_REWARD
    })
  );

  const stakes = mapIndexerRows(response?.stakingLocks, withAmount(TransactionTypeEnum.STAKE));
  const unstakes = mapIndexerRows(response?.stakingFrees, withAmount(TransactionTypeEnum.UNSTAKE));
  const borrows = mapIndexerRows(response?.stakingDraws, withAmount(TransactionTypeEnum.STAKE_BORROW));
  const repays = mapIndexerRows(response?.stakingWipes, withAmount(TransactionTypeEnum.STAKE_REPAY));

  const rewards = mapIndexerRows<
    BaseStakeHistoryItemResponse & { reward: string; amt: string },
    StakeClaimReward
  >(response?.stakingGetRewards, e => {
    const amount = safeBigInt(e.amt);
    if (amount === undefined) return undefined;
    return { ...base(e), rewardContract: e.reward, amount, type: TransactionTypeEnum.STAKE_REWARD };
  });

  const kicks = mapIndexerRows<
    BaseStakeHistoryItemResponse & { wad: string; urn: { address: string } | null },
    StakeHistoryKick
  >(response?.stakingOnKicks, e => {
    const amount = safeBigInt(e.wad);
    if (amount === undefined || !e.urn?.address) return undefined;
    return {
      amount,
      urnAddress: e.urn.address,
      blockTimestamp: secondsToDate(e.blockTimestamp),
      transactionHash: e.transactionHash,
      module: ModuleEnum.STAKE,
      type: TransactionTypeEnum.UNSTAKE_KICK,
      chainId
    };
  });

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
