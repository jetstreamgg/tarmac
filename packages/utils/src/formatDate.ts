import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { localeImports, LocaleModule } from './locale.constants';

//map lingui locale strings to date-fns locales
//default to enUS
export const getDateLocale = async (locale: string): Promise<Locale> => {
  const [code, region] = locale.split('-');
  let localeModule: LocaleModule;
  try {
    const localeFn = localeImports[`${code}${region}`] || localeImports[`${code}`] || localeImports['enUS'];
    localeModule = await localeFn();
  } catch (error) {
    console.error('Error importing locale: ', error);
    localeModule = await import('date-fns/locale/en-US');
  }
  // In date-fns v3, locales export both 'default' and a named export
  // The named export is the locale object we need
  const localeKey = Object.keys(localeModule).find(
    key => key !== 'default' && typeof localeModule[key] === 'object'
  );
  return localeKey ? localeModule[localeKey] : localeModule.default;
};

//formats Date using provided lingui locale string and dateFormat string
export function formatDate(date: Date, locale: Locale, dateFormat = 'MMMM d, yyyy, h:mm a') {
  return format(date, dateFormat, { locale });
}
