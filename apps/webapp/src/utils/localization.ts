const LOCALE_KEY = 'tarmacLocale';

export const getLocaleFromLocalStorage = (): string | null => {
  try {
    return window.localStorage.getItem(LOCALE_KEY);
  } catch {
    // Some browsers throw on any storage access; this runs at boot, so never let it surface.
    return null;
  }
};

export const getSupportedNumberLocale = (_paramLocale?: string): string => {
  return 'en-US'; //hardcoding number locale to en-US for now
  // const locale = _paramLocale || getLocaleFromLocalStorage();
  // if (!locale) return 'en-US';

  // const supportedLocale = Intl.NumberFormat.supportedLocalesOf(locale)[0];
  // return supportedLocale || 'en-US';
};
