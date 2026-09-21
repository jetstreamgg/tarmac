import { describe, expect, it, vi } from 'vitest';
import { enUS } from 'date-fns/locale/en-US';
import { fr } from 'date-fns/locale/fr';

vi.mock('./locale.constants', () => ({
  localeImports: {
    fr: () => Promise.resolve({ fr }),
    de: () => Promise.reject(new Error("'text/html' is not a valid JavaScript MIME type."))
  }
}));

describe('getDateLocale', () => {
  it('resolves a locale that loads', async () => {
    const { getDateLocale } = await import('./formatDate');
    expect(await getDateLocale('fr-FR')).toBe(fr);
  });

  it('resolves an unknown locale to the bundled enUS without importing anything', async () => {
    const { getDateLocale } = await import('./formatDate');
    expect(await getDateLocale('en-US')).toBe(enUS);
    expect(await getDateLocale('')).toBe(enUS);
  });

  it('falls back to the bundled enUS when the locale chunk fails to load', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { getDateLocale } = await import('./formatDate');
    expect(await getDateLocale('de-DE')).toBe(enUS);
  });
});
