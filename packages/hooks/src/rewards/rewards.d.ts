import { Token } from '@jetstreamgg/sky-hooks';
import { HistoryItem } from '../shared/shared';

export type RewardUserHistoryItem = HistoryItem & {
  amount: bigint;
  rewardsClaim: boolean;
  rewardContractAddress?: string;
};

export type RewardHistory = {
  id: string;
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

type RewardContractChangeRaw = {
  id: string;
  blockTimestamp: string;
  transactionHash: string;
  amount: bigint;
};

export type RewardContractChange = {
  id: string;
  blockTimestamp: number;
  transactionHash: string;
  amount: bigint;
};

export type RewardContractInfoRaw = {
  totalSupplied: string;
  totalRewardsClaimed: string;
  supplyInstances: RewardContractChangeRaw[];
  withdrawals: RewardContractChangeRaw[];
  rewardClaims: RewardContractChangeRaw[];
  tvl: RewardContractChangeRaw[];
  suppliers: {
    user: string;
  }[];
};
// parse the raw data from the subgraph into a more usable format
export type RewardContractInfo = {
  totalSupplied: bigint;
  totalRewardsClaimed: bigint;
  supplyInstances: RewardContractChange[];
  withdrawals: RewardContractChange[];
  rewardClaims: RewardContractChange[];
  tvl: RewardContractChange[];
  suppliers: {
    user: string;
  }[];
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
