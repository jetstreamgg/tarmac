import { HistoryItem } from '../shared/shared';

export type BaseStakeHistoryItemResponse = {
  index: string;
  blockTimestamp: string;
  transactionHash: string;
};

export type StakeSelectDelegateResponse = BaseStakeHistoryItemResponse & {
  voteDelegate: {
    address: string;
  };
};

export type StakeSelectRewardResponse = BaseStakeHistoryItemResponse & {
  reward: {
    address: string;
  };
};

export type BaseStakeHistoryItem = HistoryItem & {
  urnIndex?: number;
  urnAddress?: string;
};

export type StakeHistoryItemWithAmount = BaseStakeHistoryItem & {
  amount: bigint;
};

export type StakeSelectDelegate = BaseStakeHistoryItem & {
  delegate: string;
};

export type StakeSelectReward = BaseStakeHistoryItem & {
  rewardContract: string;
};

export type StakeClaimReward = BaseStakeHistoryItem & {
  rewardContract: string;
  amount: bigint;
};

export type StakeHistoryKick = BaseStakeHistoryItem & {
  amount: bigint;
  urnAddress: string;
};

export type StakeHistoryItem =
  | BaseStakeHistoryItem
  | StakeHistoryItemWithAmount
  | StakeSelectDelegate
  | StakeSelectReward
  | StakeClaimReward
  | StakeHistoryKick;

export type StakeHistory = Array<StakeHistoryItem>;
