import { WriteHookParams, WriteHook } from '../hooks';
import { HistoryItem } from '../shared/shared';

export type StakeWriteHookParams = WriteHookParams & {
  calldata?: `0x${string}`;
};

export type StakeWriteHookReturnType = WriteHook & {
  calldata?: `0x${string}`;
};

export type UrnInfoRaw = {
  id: `0x${string}`;
  blockTimestamp: number;
  rewardContract: {
    id: `0x${string}`;
  };
  mkrLocked: string;
  nstDebt: string;
  owner: `0x${string}`;
  voteDelegate: {
    id: `0x${string}`;
    ownerAddress: `0x${string}`;
    totalDelegated: string;
    metadata: {
      name: string;
      description: string;
    };
  };
  index: number;
};

export type UrnInfo = UrnInfoRaw & {
  mkrLocked: bigint;
  nstDebt: bigint;
  voteDelegate: Omit<UrnInfoRaw['voteDelegate'], 'totalDelegated'> & {
    totalDelegated: bigint;
  };
};

export type BaseStakeHistoryItemResponse = {
  index: string;
  blockTimestamp: string;
  transactionHash: string;
};

export type StakeSelectDelegateResponse = BaseStakeHistoryItemResponse & {
  voteDelegate: {
    id: string;
  };
};

export type StakeSelectRewardResponse = BaseStakeHistoryItemResponse & {
  reward: {
    id: string;
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
  wad: bigint;
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

export type Bark = {
  id: string;
  ilk: string;
  clipperId: string;
};

export type StakePosition = {
  owner: string;
  index: number;
  skyLocked: bigint;
  usdsDebt: bigint;
  selectedDelegate: string | undefined;
  selectedReward: string | undefined;
  barks: Bark[];
};
