import { StakeToken } from '../../stake/constants';

export type Theme = 'dark' | 'light';

export type UserConfig = {
  locale?: string;
  theme?: Theme;
  stakeToken?: StakeToken;
  batchEnabled: boolean;
  expertRiskDisclaimerShown?: boolean;
  expertRiskDisclaimerDismissed?: boolean;
  stakingSpkDisclaimerDismissed?: boolean;
};
