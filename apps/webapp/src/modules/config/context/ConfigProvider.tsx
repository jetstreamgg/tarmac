import { ReactElement, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { UserConfig } from '../types/user-config';
import { RewardContract } from '@jetstreamgg/sky-hooks';
import { ALLOWED_EXTERNAL_DOMAINS, USER_SETTINGS_KEY } from '@/lib/constants';
import { ExpertIntent } from '@/lib/enums';
import { dynamicActivate } from '@jetstreamgg/sky-utils';
import { i18n } from '@lingui/core';
import {
  ConfigContext,
  defaultLinkedActionConfig,
  defaultUserConfig,
  LinkedActionConfig
} from './ConfigContext';
import { defaultConfig as siteConfig } from '../default-config';

export const ConfigProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [userConfig, setUserConfig] = useState<UserConfig>(defaultUserConfig);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [selectedRewardContract, setSelectedRewardContract] = useState<RewardContract | undefined>(undefined);
  const [selectedSealUrnIndex, setSelectedSealUrnIndex] = useState<number | undefined>(undefined);
  const [selectedStakeUrnIndex, setSelectedStakeUrnIndex] = useState<number | undefined>(undefined);
  const [linkedActionConfig, setLinkedActionConfig] = useState(defaultLinkedActionConfig);
  const [externalLinkModalOpened, setExternalLinkModalOpened] = useState(false);
  const [externalLinkModalUrl, setExternalLinkModalUrl] = useState('');
  const [selectedExpertOption, setSelectedExpertOption] = useState<ExpertIntent | undefined>(undefined);

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
          import.meta.env.VITE_BATCH_TX_ENABLED === 'true' ? (parsed.batchEnabled ?? true) : undefined,
        expertRiskDisclaimerShown: parsed.expertRiskDisclaimerShown ?? false,
        expertRiskDisclaimerDismissed: parsed.expertRiskDisclaimerDismissed ?? false,
        spkEmissionsDisclaimerDismissed: parsed.spkEmissionsDisclaimerDismissed ?? false
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

  const setSpkEmissionsDisclaimerDismissed = (dismissed: boolean) => {
    updateUserConfig({
      ...userConfig,
      spkEmissionsDisclaimerDismissed: dismissed
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
        expertRiskDisclaimerShown: userConfig.expertRiskDisclaimerShown ?? false,
        setExpertRiskDisclaimerShown,
        expertRiskDisclaimerDismissed: userConfig.expertRiskDisclaimerDismissed ?? false,
        setExpertRiskDisclaimerDismissed,
        spkEmissionsDisclaimerDismissed: userConfig.spkEmissionsDisclaimerDismissed ?? false,
        setSpkEmissionsDisclaimerDismissed
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
