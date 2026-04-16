import { Token } from '@jetstreamgg/sky-hooks';
import { HistoryItem } from '../shared/shared';

export type RewardUserHistoryItem = HistoryItem & {
  amount: bigint;
  rewardsClaim: boolean;
  rewardContractAddress?: string;
};

export type RewardHistory = {
  id: string;
  address: string;
  supplyInstances: {
    blockTimestamp: string;
    transactionHash: string;
    amount: string;
  }[];
  withdrawals: {
    blockTimestamp: string;
    transactionHash: string;
    amount: string;
  }[];
  rewardClaims: {
    blockTimestamp: string;
    transactionHash: string;
    amount: string;
  }[];
};

export type RewardUserHistoryResponse = {
  reward: RewardHistory;
};

export type AllRewardsUserHistoryResponse = {
  rewards: RewardHistory[];
};

export type RewardContractInfoRaw = {
  totalSupplied: string;
  totalRewardsClaimed: string;
};

export type RewardContractInfo = {
  totalSupplied: bigint;
  totalRewardsClaimed: bigint;
};

export type RewardContract = {
  supplyToken: Token;
  rewardToken: Token;
  chainId: number;
  contractAddress: string;
  name: string;
  description: string;
  externalLink: string;
  logo: string;
  featured?: boolean;
};
