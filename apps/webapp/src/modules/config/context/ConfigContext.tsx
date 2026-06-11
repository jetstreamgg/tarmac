import { createContext } from 'react';
import { SiteConfig } from '../types/site-config';
import { UserConfig } from '../types/user-config';
import { defaultConfig as siteConfig } from '../default-config';
import { ConvertIntent, ExpertIntent, VaultsIntent } from '@/lib/enums';
import { RewardContract } from '@/hooks';
import { StakeToken } from '@/modules/stake/constants';
import { DEFAULT_THEME } from '@/lib/theme';

// Default user config
export const defaultUserConfig: UserConfig = {
  locale: undefined,
  theme: DEFAULT_THEME,
  stakeToken: StakeToken.SKY,
  batchEnabled: false, // Default to false to show activation prompt
  expertRiskDisclaimerShown: false,
  expertRiskDisclaimerDismissed: false,
  stakingSpkDisclaimerDismissed: false,
  rewardsUsdsSkyDisclaimerDismissed: false
};

export interface ConfigContextProps {
  siteConfig: SiteConfig;
  userConfig: UserConfig;
  loaded: boolean;
  locale: string;
  updateUserConfig: (config: UserConfig) => void;
  selectedRewardContract?: RewardContract;
  setSelectedRewardContract: (rewardContract?: RewardContract) => void;
  selectedStakeUrnIndex: number | undefined;
  setSelectedStakeUrnIndex: (position: number | undefined) => void;
  externalLinkModalOpened: boolean;
  setExternalLinkModalOpened: (val: boolean) => void;
  externalLinkModalUrl: string;
  setExternalLinkModalUrl: (val: string) => void;
  onExternalLinkClicked: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  selectedExpertOption: ExpertIntent | undefined;
  setSelectedExpertOption: (intent: ExpertIntent | undefined) => void;
  selectedVaultsOption: VaultsIntent | undefined;
  setSelectedVaultsOption: (intent: VaultsIntent | undefined) => void;
  selectedConvertOption: ConvertIntent | undefined;
  setSelectedConvertOption: (intent: ConvertIntent | undefined) => void;
  expertRiskDisclaimerShown: boolean;
  setExpertRiskDisclaimerShown: (shown: boolean) => void;
  expertRiskDisclaimerDismissed: boolean;
  setExpertRiskDisclaimerDismissed: (dismissed: boolean) => void;
  stakingSpkDisclaimerDismissed: boolean;
  setStakingSpkDisclaimerDismissed: (dismissed: boolean) => void;
  rewardsUsdsSkyDisclaimerDismissed: boolean;
  setRewardsUsdsSkyDisclaimerDismissed: (dismissed: boolean) => void;
}

// Zod schema for validating user settings
// const userSettingsSchema = z.object({
//   locale: z.string().optional(),
//   intent: z.nativeEnum(Intent).optional()
// });

export const ConfigContext = createContext<ConfigContextProps>({
  siteConfig: siteConfig,
  userConfig: defaultUserConfig,
  loaded: false,
  locale: 'en',
  updateUserConfig: () => {
    // do nothing.
  },
  selectedRewardContract: undefined,
  setSelectedRewardContract: () => {},
  selectedStakeUrnIndex: undefined,
  setSelectedStakeUrnIndex: () => {},
  externalLinkModalOpened: false,
  setExternalLinkModalOpened: () => {},
  externalLinkModalUrl: '',
  setExternalLinkModalUrl: () => {},
  onExternalLinkClicked: () => {},
  selectedExpertOption: undefined,
  setSelectedExpertOption: () => {},
  selectedVaultsOption: undefined,
  setSelectedVaultsOption: () => {},
  selectedConvertOption: undefined,
  setSelectedConvertOption: () => {},
  expertRiskDisclaimerShown: false,
  setExpertRiskDisclaimerShown: () => {},
  expertRiskDisclaimerDismissed: false,
  setExpertRiskDisclaimerDismissed: () => {},
  stakingSpkDisclaimerDismissed: false,
  setStakingSpkDisclaimerDismissed: () => {},
  rewardsUsdsSkyDisclaimerDismissed: false,
  setRewardsUsdsSkyDisclaimerDismissed: () => {}
});
