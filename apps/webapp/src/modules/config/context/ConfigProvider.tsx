import { ReactElement, ReactNode, useEffect, useMemo, useState } from 'react';
import { UserConfig } from '../types/user-config';
import { USER_SETTINGS_KEY } from '@/lib/constants';
import { dynamicActivate } from '@/utils';
import { applyTheme, getSystemTheme } from '@/lib/theme';
import { i18n } from '@lingui/core';
import { ConfigContext, defaultUserConfig } from './ConfigContext';
import { defaultConfig as siteConfig } from '../default-config';
import { reportError } from '@/modules/sentry/reportError';

export const ConfigProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [userConfig, setUserConfig] = useState<UserConfig>(defaultUserConfig);
  const [loaded, setLoaded] = useState<boolean>(false);

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
        // Fall back to the OS color-scheme preference on first visit
        theme: parsed.theme ?? getSystemTheme(),
        batchEnabled:
          // If the feature flag is enabled, but the local storage item is not set, default to enabled
          import.meta.env.VITE_BATCH_TX_ENABLED === 'true' ? (parsed.batchEnabled ?? true) : undefined,
        expertRiskDisclaimerShown: parsed.expertRiskDisclaimerShown ?? false,
        expertRiskDisclaimerDismissed: parsed.expertRiskDisclaimerDismissed ?? false,
        stakingSpkDisclaimerDismissed: parsed.stakingSpkDisclaimerDismissed ?? false
      });
    } catch (e) {
      reportError(e, {
        module: 'config',
        flow: 'user-settings',
        action: 'parse-local-storage',
        type: 'local_storage_parse_error'
      });
      window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(userConfig));
    }
    setLoaded(true);
  }, []);

  // Sync `data-theme` with the user's theme (index.html sets the initial value).
  useEffect(() => {
    if (userConfig.theme) {
      applyTheme(userConfig.theme);
    }
  }, [userConfig.theme]);

  const updateUserConfig = (config: UserConfig) => {
    setUserConfig(config);
    window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(config));
  };

  const locale = useMemo(() => {
    // const locale = userConfig.locale || 'en';
    const locale = 'en';
    dynamicActivate(i18n, locale);
    return locale;
  }, [userConfig]);

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

  return (
    <ConfigContext.Provider
      value={{
        siteConfig,
        userConfig,
        updateUserConfig,
        loaded,
        locale,
        expertRiskDisclaimerShown: userConfig.expertRiskDisclaimerShown ?? false,
        setExpertRiskDisclaimerShown,
        expertRiskDisclaimerDismissed: userConfig.expertRiskDisclaimerDismissed ?? false,
        setExpertRiskDisclaimerDismissed,
        stakingSpkDisclaimerDismissed: userConfig.stakingSpkDisclaimerDismissed ?? false,
        setStakingSpkDisclaimerDismissed
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
};
