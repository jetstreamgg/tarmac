import { ReactElement, ReactNode, createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { SiteConfig } from '../types/site-config';
import { UserConfig } from '../types/user-config';
import { defaultConfig as siteConfig } from '../default-config';
// import { detect, fromUrl, fromNavigator } from '@lingui/detect-locale';
// import { QueryParams } from '@/lib/constants';
import { i18n } from '@lingui/core';
import { dynamicActivate } from '@jetstreamgg/sky-utils';
import { Intent } from '@/lib/enums';
// import { z } from 'zod';
import { RewardContract } from '@jetstreamgg/sky-hooks';
import { ALLOWED_EXTERNAL_DOMAINS, USER_SETTINGS_KEY } from '@/lib/constants';
import { SealToken } from '@/modules/seal/constants';
import { StakeToken } from '@/modules/stake/constants';

type LinkedActionConfig = {
  inputAmount?: string;
  initialAction?: string | null;
  linkedAction?: string;
  showLinkedAction: boolean;
  sourceToken?: string;
  targetToken?: string;
  rewardContract?: string;
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
const defaultUserConfig: UserConfig = {
  locale: undefined,
  intent: Intent.BALANCES_INTENT,
  sealToken: SealToken.MKR,
  stakeToken: StakeToken.SKY,
  batchEnabled: false // Default to false to show activation prompt
};

const defaultLinkedActionConfig = {
  step: 0,
  showLinkedAction: false
};

export interface ConfigContextProps {
  siteConfig: SiteConfig;
  userConfig: UserConfig;
  loaded: boolean;
  locale: string;
  updateUserConfig: (config: UserConfig) => void;
  setIntent: (intent: Intent) => void;
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
  setIntent: () => {},
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
  onExternalLinkClicked: () => {}
});

export const ConfigProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [userConfig, setUserConfig] = useState<UserConfig>(defaultUserConfig);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [selectedRewardContract, setSelectedRewardContract] = useState<RewardContract | undefined>(undefined);
  const [selectedSealUrnIndex, setSelectedSealUrnIndex] = useState<number | undefined>(undefined);
  const [selectedStakeUrnIndex, setSelectedStakeUrnIndex] = useState<number | undefined>(undefined);
  const [linkedActionConfig, setLinkedActionConfig] = useState(defaultLinkedActionConfig);
  const [externalLinkModalOpened, setExternalLinkModalOpened] = useState(false);
  const [externalLinkModalUrl, setExternalLinkModalUrl] = useState('');

  // Check the user settings on load, and set locale
  useEffect(() => {
    // const localeFromUrl = fromUrl(QueryParams.Locale);
    // const backupLocale = detect(fromNavigator(), () => 'en');
    const settings = window.localStorage.getItem(USER_SETTINGS_KEY);
    try {
      const parsed = JSON.parse(settings || '{}');
      // Use Zod to parse and validate the user settings
      //throws an error if settings don't match the zod schema
      // const parsedAndValidated = userSettingsSchema.parse(parsed);
      // const localeFromConfig = parsedAndValidated.locale;
      setUserConfig({
        ...userConfig,
        ...parsed,
        // locale: localeFromUrl || localeFromConfig || backupLocale
        locale: 'en',
        batchEnabled:
          // If the feature flag is enabled, but the local storage item is not set, default to enabled
          import.meta.env.VITE_BATCH_TX_ENABLED === 'true' ? (parsed.batchEnabled ?? true) : undefined
      });
    } catch (e) {
      console.log('Error parsing user settings', e);
      window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(userConfig));
    }
    setLoaded(true);
  }, []);

  const updateUserConfig = (config: UserConfig) => {
    setUserConfig(config);
    window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(config));

    // We needed to reload because changing the wagmi client messed with the rainbowkit buttons.
    // https://github.com/rainbow-me/rainbowkit/issues/953
    // TODO: Reenable if problem persist window.location.reload();
  };

  const setIntent = (intent: Intent) => {
    updateUserConfig({
      ...userConfig,
      intent: intent
    });
  };

  const updateLinkedActionConfig = useCallback(
    (config: Partial<LinkedActionConfig>) => {
      setLinkedActionConfig(prevConfig => ({
        ...prevConfig,
        ...config
      }));
    },
    [setLinkedActionConfig]
  );

  // Convenience function to safely exit linked action mode
  const exitLinkedActionMode = useCallback(() => {
    setLinkedActionConfig(defaultLinkedActionConfig);
  }, [setLinkedActionConfig]);

  const locale = useMemo(() => {
    // const locale = userConfig.locale || 'en';
    const locale = 'en';
    dynamicActivate(i18n, locale);
    return locale;
  }, [userConfig]);

  const onExternalLinkClicked = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      const href = e.currentTarget.getAttribute('href');
      if (!href) return;

      const hrefUrl = new URL(href);
      if (!ALLOWED_EXTERNAL_DOMAINS.includes(hrefUrl.hostname)) {
        e.preventDefault();
        setExternalLinkModalUrl(href);
        setExternalLinkModalOpened(true);
      }
    },
    [setExternalLinkModalUrl, setExternalLinkModalOpened]
  );

  return (
    <ConfigContext.Provider
      value={{
        siteConfig,
        userConfig,
        updateUserConfig,
        loaded,
        locale,
        setIntent,
        selectedRewardContract,
        setSelectedRewardContract,
        selectedSealUrnIndex,
        setSelectedSealUrnIndex,
        selectedStakeUrnIndex: selectedStakeUrnIndex,
        setSelectedStakeUrnIndex: setSelectedStakeUrnIndex,
        linkedActionConfig,
        updateLinkedActionConfig,
        exitLinkedActionMode,
        externalLinkModalOpened,
        setExternalLinkModalOpened,
        externalLinkModalUrl,
        setExternalLinkModalUrl,
        onExternalLinkClicked
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
