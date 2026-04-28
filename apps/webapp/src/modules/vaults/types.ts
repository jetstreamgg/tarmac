export type ActionType =
  // Savings
  | 'deposit_assets'
  | 'withdraw_assets'
  | 'redeem_shares'
  | 'mint_shares'
  // Upgrade
  | 'upgrade_dai_to_usds'
  | 'revert_usds_to_dai'
  | 'upgrade_mkr_to_sky'
  | 'revert_sky_to_mkr'
  // Rewards
  | 'rewards_supply'
  | 'rewards_withdraw'
  | 'rewards_claim'
  | 'rewards_claim_all'
  // Staking
  | 'stake_open'
  | 'stake_lock'
  | 'stake_free'
  | 'stake_borrow'
  | 'stake_repay'
  | 'stake_repay_all'
  | 'stake_claim'
  | 'stake_select_delegate'
  | 'stake_select_reward'
  // stUSDS
  | 'stusds_deposit'
  | 'stusds_withdraw'
  // Morpho Vaults
  | 'morpho_deposit'
  | 'morpho_withdraw'
  // Vaults overview
  | 'vaults_overview';

export type RewardContractId = 'usdsSkyReward' | 'usdsSpkReward' | 'cleReward';

export type StakingRewardFarmId = 'lsSkyUsdsReward' | 'lsSkySpkReward' | 'lsSkySkyReward' | 'lsMkrUsdsReward';

export type ParsedIntent = {
  action: ActionType;
  amount: string;
  unit: 'assets' | 'shares';
  referral?: number;
  rewardContract?: RewardContractId;
  collateralToken?: 'SKY' | 'MKR';
  urnIndex?: number;
  delegateAddress?: string;
  stakingRewardFarm?: StakingRewardFarmId;
};
