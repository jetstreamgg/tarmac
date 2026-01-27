import { createContext } from 'react';
import { SiteConfig } from '../types/site-config';
import { UserConfig } from '../types/user-config';
import { defaultConfig as siteConfig } from '../default-config';
import { ExpertIntent } from '@/lib/enums';
import { RewardContract } from '@jetstreamgg/sky-hooks';
import { SealToken } from '@/modules/seal/constants';
import { StakeToken } from '@/modules/stake/constants';

export type LinkedActionConfig = {
  inputAmount?: string;
  initialAction?: string | null;
  linkedAction?: string;
  showLinkedAction: boolean;
  sourceToken?: string;
  targetToken?: string;
  rewardContract?: string;
  expertModule?: string;
  step: number;
  timestamp?: string;
};

export enum StepIndicatorStates {
  CURRENT = 'current',
  SUCCESS = 'success',
  COMPLETED = 'completed',
  FUTURE = 'future'
}

export enum LinkedActionSteps {
  UNSTARTED = 0,
  CURRENT_FUTURE = 1,
  SUCCESS_FUTURE = 2,
  COMPLETED_CURRENT = 3,
  COMPLETED_SUCCESS = 4,
  COMPLETED_COMPLETED = 5
}

export const StepMap: Record<LinkedActionSteps, StepIndicatorStates[]> = {
  [LinkedActionSteps.UNSTARTED]: [],
  [LinkedActionSteps.CURRENT_FUTURE]: [StepIndicatorStates.CURRENT, StepIndicatorStates.FUTURE],
  [LinkedActionSteps.SUCCESS_FUTURE]: [StepIndicatorStates.SUCCESS, StepIndicatorStates.FUTURE],
  [LinkedActionSteps.COMPLETED_CURRENT]: [StepIndicatorStates.COMPLETED, StepIndicatorStates.CURRENT],
  [LinkedActionSteps.COMPLETED_SUCCESS]: [StepIndicatorStates.COMPLETED, StepIndicatorStates.SUCCESS],
  [LinkedActionSteps.COMPLETED_COMPLETED]: [StepIndicatorStates.COMPLETED, StepIndicatorStates.FUTURE]
};

// Default user config
export const defaultUserConfig: UserConfig = {
  locale: undefined,
  sealToken: SealToken.MKR,
  stakeToken: StakeToken.SKY,
  batchEnabled: false, // Default to false to show activation prompt
  expertRiskDisclaimerShown: false,
  expertRiskDisclaimerDismissed: false,
  stakingSpkDisclaimerDismissed: false,
  rewardsUsdsSkyDisclaimerDismissed: false
};

export const defaultLinkedActionConfig = {
  step: 0,
  showLinkedAction: false
};

export interface ConfigContextProps {
  siteConfig: SiteConfig;
  userConfig: UserConfig;
  loaded: boolean;
  locale: string;
  updateUserConfig: (config: UserConfig) => void;
  selectedRewardContract?: RewardContract;
  setSelectedRewardContract: (rewardContract?: RewardContract) => void;
  selectedSealUrnIndex: number | undefined;
  setSelectedSealUrnIndex: (position: number | undefined) => void;
  selectedStakeUrnIndex: number | undefined;
  setSelectedStakeUrnIndex: (position: number | undefined) => void;
  linkedActionConfig: LinkedActionConfig;
  updateLinkedActionConfig: (config: Partial<LinkedActionConfig>) => void;
  exitLinkedActionMode: () => void;
  externalLinkModalOpened: boolean;
  setExternalLinkModalOpened: (val: boolean) => void;
  externalLinkModalUrl: string;
  setExternalLinkModalUrl: (val: string) => void;
  onExternalLinkClicked: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
  selectedExpertOption: ExpertIntent | undefined;
  setSelectedExpertOption: (intent: ExpertIntent | undefined) => void;
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
  selectedSealUrnIndex: undefined,
  setSelectedSealUrnIndex: () => {},
  selectedStakeUrnIndex: undefined,
  setSelectedStakeUrnIndex: () => {},
  updateLinkedActionConfig: () => {},
  linkedActionConfig: defaultLinkedActionConfig,
  exitLinkedActionMode: () => {},
  externalLinkModalOpened: false,
  setExternalLinkModalOpened: () => {},
  externalLinkModalUrl: '',
  setExternalLinkModalUrl: () => {},
  onExternalLinkClicked: () => {},
  selectedExpertOption: undefined,
  setSelectedExpertOption: () => {},
  expertRiskDisclaimerShown: false,
  setExpertRiskDisclaimerShown: () => {},
  expertRiskDisclaimerDismissed: false,
  setExpertRiskDisclaimerDismissed: () => {},
  stakingSpkDisclaimerDismissed: false,
  setStakingSpkDisclaimerDismissed: () => {},
  rewardsUsdsSkyDisclaimerDismissed: false,
  setRewardsUsdsSkyDisclaimerDismissed: () => {}
});
