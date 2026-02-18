import { type Call } from 'viem';
import { ReadHook } from '../hooks';

export type ClaimableRewardModule = 'Rewards' | 'Staking Engine' | 'Morpho Vault';

export type ClaimableReward = {
  /** Unique identifier for selection tracking (e.g., "rewards-0xabc", "stake-0-0xdef", "morpho-0xvault") */
  id: string;
  /** Which module this reward comes from */
  module: ClaimableRewardModule;
  /** Extra context: URN index for stake, vault name for Morpho */
  moduleDetail?: string;
  /** The reward token symbol (e.g., "SKY", "SPK", "CLE", "MORPHO") */
  rewardTokenSymbol: string;
  /** The reward token decimals */
  rewardTokenDecimals: number;
  /** Raw claimable amount */
  claimableAmount: bigint;
  /** USD value of the claimable amount */
  claimableAmountUsd: number;
  /** The pre-built viem Call object, ready for useTransactionFlow */
  call: Call;
};

export type UseClaimableRewardsResponse = ReadHook & {
  data: ClaimableReward[];
};
