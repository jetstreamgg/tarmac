import { StakeToken } from '../../stake/constants';
export type UserConfig = {
  locale?: string;
  stakeToken?: StakeToken;
  batchEnabled: boolean;
  expertRiskDisclaimerShown?: boolean;
  expertRiskDisclaimerDismissed?: boolean;
  stakingSpkDisclaimerDismissed?: boolean;
  rewardsUsdsSkyDisclaimerDismissed?: boolean;
};
