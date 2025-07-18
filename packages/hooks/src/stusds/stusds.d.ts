export interface StUsdsDepositEvent {
  sender: string;
  owner: string;
  assets: bigint;
  shares: bigint;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface StUsdsWithdrawEvent {
  sender: string;
  receiver: string;
  owner: string;
  assets: bigint;
  shares: bigint;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface StUsdsReferralEvent {
  referral: number;
  owner: string;
  assets: bigint;
  shares: bigint;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface StUsdsHistoryItem {
  type: 'deposit' | 'withdraw' | 'referral';
  assets: bigint;
  shares: bigint;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
  referral?: number;
}

export interface StUsdsVaultMetrics {
  totalAssets: bigint;
  totalSupply: bigint;
  assetPerShare: bigint;
  yieldSavingsRate: bigint;
  chi: bigint;
  cap: bigint;
  line: bigint;
}

export interface StUsdsUserMetrics {
  userStUsdsBalance: bigint;
  userUsdsBalance: bigint;
  userMaxDeposit: bigint;
  userMaxWithdraw: bigint;
}
