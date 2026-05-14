import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { Token } from '../tokens/types';
import { StUsdsProviderType } from './providers/types';

export interface StUsdsHistoryItem {
  type: TransactionTypeEnum;
  assets: bigint;
  blockTimestamp: Date;
  transactionHash: string;
  module: ModuleEnum;
  chainId: number;
  token: Token;
  /** Provider that executed this transaction (native or curve) */
  provider: StUsdsProviderType;
}

export interface StUsdsVaultMetrics {
  totalAssets: bigint;
  totalSupply: bigint;
  assetPerShare: bigint;
  yieldRate: bigint;
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
