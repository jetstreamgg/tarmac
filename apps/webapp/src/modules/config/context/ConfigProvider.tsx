import { ReactElement, ReactNode, useCallback, useMemo, useState } from 'react';
import { UserConfig } from '../types/user-config';
import { RewardContract } from '@/hooks';
import { ALLOWED_EXTERNAL_DOMAINS, USER_SETTINGS_KEY } from '@/lib/constants';
import { ConvertIntent, ExpertIntent, VaultsIntent } from '@/lib/enums';
import { dynamicActivate } from '@/utils';
import { i18n } from '@lingui/core';
import {
  ConfigContext,
  defaultLinkedActionConfig,
  defaultUserConfig,
  LinkedActionConfig
} from './ConfigContext';
import { defaultConfig as siteConfig } from '../default-config';
import { reportError } from '@/modules/sentry/reportError';

// Read + merge user settings synchronously so the component renders with the
// correct config on the very first paint (no default-config flash).
const loadUserConfigFromStorage = (): UserConfig => {
  try {
    const settings = window.localStorage.getItem(USER_SETTINGS_KEY);
    const parsed = JSON.parse(settings || '{}');
    return {
      ...defaultUserConfig,
      ...parsed,
      locale: 'en',
      batchEnabled:
        // If the feature flag is enabled, but the local storage item is not set, default to enabled
        import.meta.env.VITE_BATCH_TX_ENABLED === 'true' ? (parsed.batchEnabled ?? true) : undefined,
      expertRiskDisclaimerShown: parsed.expertRiskDisclaimerShown ?? false,
      expertRiskDisclaimerDismissed: parsed.expertRiskDisclaimerDismissed ?? false,
      stakingSpkDisclaimerDismissed: parsed.stakingSpkDisclaimerDismissed ?? false,
      rewardsUsdsSkyDisclaimerDismissed: parsed.rewardsUsdsSkyDisclaimerDismissed ?? false
    };
  } catch (e) {
    reportError(e, {
      module: 'config',
      flow: 'user-settings',
      action: 'parse-local-storage',
      type: 'local_storage_parse_error'
    });
    window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(defaultUserConfig));
    return defaultUserConfig;
  }
};

export const ConfigProvider = ({ children }: { children: ReactNode }): ReactElement => {
  // Lazy initializer reads + merges localStorage synchronously on mount.
  const [userConfig, setUserConfig] = useState<UserConfig>(loadUserConfigFromStorage);
  // `loaded` is kept in the context API for backwards compat; since the lazy
  // init populates userConfig synchronously, there is no "loading" phase.
  const [loaded] = useState<boolean>(true);
  const [selectedRewardContract, setSelectedRewardContract] = useState<RewardContract | undefined>(undefined);
  const [selectedSealUrnIndex, setSelectedSealUrnIndex] = useState<number | undefined>(undefined);
  const [selectedStakeUrnIndex, setSelectedStakeUrnIndex] = useState<number | undefined>(undefined);
  const [linkedActionConfig, setLinkedActionConfig] = useState(defaultLinkedActionConfig);
  const [externalLinkModalOpened, setExternalLinkModalOpened] = useState(false);
  const [externalLinkModalUrl, setExternalLinkModalUrl] = useState('');
  const [selectedExpertOption, setSelectedExpertOption] = useState<ExpertIntent | undefined>(undefined);
  const [selectedVaultsOption, setSelectedVaultsOption] = useState<VaultsIntent | undefined>(undefined);
  const [selectedConvertOption, setSelectedConvertOption] = useState<ConvertIntent | undefined>(undefined);

  const updateUserConfig = (config: UserConfig) => {
    setUserConfig(config);
    window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(config));
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

  const setExpertRiskDisclaimerShown = (shown: boolean) => {
    updateUserConfig({
      ...userConfig,
      expertRiskDisclaimerShown: shown
    });
  };

  const setExpertRiskDisclaimerDismissed = (dismissed: boolean) => {
    updateUserConfig({
      ...userConfig,
      expertRiskDisclaimerDismissed: dismissed
    });
  };

  const setStakingSpkDisclaimerDismissed = (dismissed: boolean) => {
    updateUserConfig({
      ...userConfig,
      stakingSpkDisclaimerDismissed: dismissed
    });
  };

  const setRewardsUsdsSkyDisclaimerDismissed = (dismissed: boolean) => {
    updateUserConfig({
      ...userConfig,
      rewardsUsdsSkyDisclaimerDismissed: dismissed
    });
  };

  return (
    <ConfigContext.Provider
      value={{
        siteConfig,
        userConfig,
        updateUserConfig,
        loaded,
        locale,
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
        onExternalLinkClicked,
        selectedExpertOption,
        setSelectedExpertOption,
        selectedVaultsOption,
        setSelectedVaultsOption,
        selectedConvertOption,
        setSelectedConvertOption,
        expertRiskDisclaimerShown: userConfig.expertRiskDisclaimerShown ?? false,
        setExpertRiskDisclaimerShown,
        expertRiskDisclaimerDismissed: userConfig.expertRiskDisclaimerDismissed ?? false,
        setExpertRiskDisclaimerDismissed,
        stakingSpkDisclaimerDismissed: userConfig.stakingSpkDisclaimerDismissed ?? false,
        setStakingSpkDisclaimerDismissed,
        rewardsUsdsSkyDisclaimerDismissed: userConfig.rewardsUsdsSkyDisclaimerDismissed ?? false,
        setRewardsUsdsSkyDisclaimerDismissed
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
