const LOCALE_KEY = 'tarmacLocale';

export const getLocaleFromLocalStorage = (): string | null => window.localStorage.getItem(LOCALE_KEY);

export const getSupportedNumberLocale = (_paramLocale?: string): string => {
  return 'en-US'; //hardcoding number locale to en-US for now
  // const locale = _paramLocale || getLocaleFromLocalStorage();
  // if (!locale) return 'en-US';

  // const supportedLocale = Intl.NumberFormat.supportedLocalesOf(locale)[0];
  // return supportedLocale || 'en-US';
};
