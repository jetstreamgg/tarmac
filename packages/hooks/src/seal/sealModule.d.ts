import { WriteHookParams, WriteHook } from '../hooks';
import { HistoryItem } from '../shared/shared';

export type SaWriteHookParams = WriteHookParams & {
  calldata?: `0x${string}`;
};

export type SaWriteHookReturnType = WriteHook & {
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

export type BaseSealHistoryItemResponse = {
  index: string;
  blockTimestamp: string;
  transactionHash: string;
};

export type SealSelectDelegateResponse = BaseSealHistoryItemResponse & {
  voteDelegate: {
    id: string;
  };
};

export type SealSelectRewardResponse = BaseSealHistoryItemResponse & {
  reward: {
    id: string;
  };
};

export type BaseSealHistoryItem = HistoryItem & {
  urnIndex?: number;
  urnAddress?: string;
};

export type SealHistoryItemWithAmount = BaseSealHistoryItem & {
  amount: bigint;
};

export type SealSelectDelegate = BaseSealHistoryItem & {
  delegate: string;
};

export type SealSelectReward = BaseSealHistoryItem & {
  rewardContract: string;
};

export type SealClaimReward = BaseSealHistoryItem & {
  rewardContract: string;
  amount: bigint;
};

export type SealHistoryKick = BaseSealHistoryItem & {
  wad: bigint;
  urnAddress: string;
};

export type SealHistoryItem =
  | BaseSealHistoryItem
  | SealHistoryItemWithAmount
  | SealSelectDelegate
  | SealSelectReward
  | SealClaimReward
  | SealHistoryKick;

export type SealHistory = Array<SealHistoryItem>;

export type Bark = {
  id: string;
  ilk: string;
  clipperId: string;
};

export type SealPosition = {
  owner: string;
  index: number;
  mkrLocked: bigint;
  usdsDebt: bigint;
  selectedDelegate: string | undefined;
  selectedReward: string | undefined;
  barks: Bark[];
};
