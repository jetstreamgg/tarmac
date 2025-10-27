/// <reference types="vite/client" />
import { I18n } from '@lingui/core';

/**
 * Dynamically imports and activates the required language catalog based on the provided locale.
 * This function tries to load the catalog in the following order until it succeeds:
 * 1. The exact locale provided.
 * 2. The base locale (language code without the country code, e.g., 'en' for 'en-US').
 * 3. The default locale specified in the application's configuration.
 * 4. English ('en'), used as a last resort if the above steps fail.
 *
 * This function is designed to fall back to English if the user's locale isn't supported, or if the default locale isn't specified in the configuration.
 *
 * @param locale A string representing the desired locale (e.g., 'en-US', 'fr-CA').
 */
export async function dynamicActivate(i18n: I18n, locale: string) {
  const baseLocale = locale.split('-').shift();

  const messages = (await loadLocale(locale)) || (await loadLocale(baseLocale)) || (await loadLocale('en'));

  i18n.loadAndActivate({ locale, messages });
}

// Use Vite's import.meta.glob for static analysis compatibility
const localeModules = import.meta.glob<{ messages: any }>('./locales/*.ts');

/**
 * Helper function to load a given locale.
 * Returns messages if the locale file exists, otherwise null.
 * @param locale
 */
async function loadLocale(locale?: string) {
  if (!locale) return null;

  try {
    const modulePath = `./locales/${locale}.ts`;
    const loader = localeModules[modulePath];

    if (!loader) {
      console.error(`Locale file for ${locale} not found.`);
      return null;
    }

    const { messages } = await loader();
    console.log(`Locale file for ${locale} loaded.`);
    return messages;
  } catch (error) {
    console.error(`Error loading locale file for ${locale}: `, error);
    return null;
  }
}
