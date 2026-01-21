import { SealToken } from '../../seal/constants';
import { StakeToken } from '../../stake/constants';
export type UserConfig = {
  locale?: string;
  sealToken?: SealToken;
  stakeToken?: StakeToken;
  batchEnabled: boolean;
  expertRiskDisclaimerShown?: boolean;
  expertRiskDisclaimerDismissed?: boolean;
};
