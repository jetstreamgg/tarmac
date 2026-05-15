const LOCALE_KEY = 'tarmacLocale';

export const getLocaleFromLocalStorage = (): string | null => window.localStorage.getItem(LOCALE_KEY);

export const setLocaleInLocaleStorage = (locale: string) => {
  const localeFromLocalStorage = getLocaleFromLocalStorage();
  if (locale !== localeFromLocalStorage) window.localStorage.setItem(LOCALE_KEY, locale);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getSupportedNumberLocale = (paramLocale?: string): string => {
  return 'en-US'; //hardcoding number locale to en-US for now
  // const locale = paramLocale || getLocaleFromLocalStorage();
  // if (!locale) return 'en-US';

  // const supportedLocale = Intl.NumberFormat.supportedLocalesOf(locale)[0];
  // return supportedLocale || 'en-US';
};

export const getTextDirection = (localeCode: string): string => {
  const rtlLocales = ['ar', 'fa', 'ur', 'he', 'yi', 'syc', 'dv', 'ku'];
  if (rtlLocales.includes(localeCode.substring(0, 2))) {
    return 'rtl';
  } else {
    return 'ltr';
  }
};
