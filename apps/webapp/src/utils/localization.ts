const LOCALE_KEY = 'tarmacLocale';

export const getLocaleFromLocalStorage = (): string | null => window.localStorage.getItem(LOCALE_KEY);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getSupportedNumberLocale = (paramLocale?: string): string => {
  return 'en-US'; //hardcoding number locale to en-US for now
  // const locale = paramLocale || getLocaleFromLocalStorage();
  // if (!locale) return 'en-US';

  // const supportedLocale = Intl.NumberFormat.supportedLocalesOf(locale)[0];
  // return supportedLocale || 'en-US';
};
