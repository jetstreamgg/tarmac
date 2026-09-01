import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFooterLinks } from './utils';

const setEnv = (value: string | undefined) => vi.stubEnv('VITE_FOOTER_LINKS', value as unknown as string);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getFooterLinks', () => {
  it('parses the deployment-configured links', () => {
    setEnv(
      JSON.stringify([
        { url: 'https://docs.sky.money/legal-terms', name: 'Terms of Use' },
        { url: 'https://immunefi.com/bug-bounty/sky/information/', name: 'Bug Bounty' }
      ])
    );

    expect(getFooterLinks().map(l => l.name)).toEqual(['Terms of Use', 'Bug Bounty']);
  });

  // APP-456 #4: the Careers link is the deployment's only `highlight` entry.
  // Dropping it here removes it from every surface without waiting on the
  // Vercel env var to be edited.
  it('drops promoted (highlight) entries such as Careers', () => {
    setEnv(
      JSON.stringify([
        { url: 'https://docs.sky.money/legal-terms', name: 'Terms of Use' },
        { url: 'https://jobs.ashbyhq.com/skyecosystem', name: 'Careers', highlight: 'true' }
      ])
    );

    expect(getFooterLinks().map(l => l.name)).toEqual(['Terms of Use']);
  });

  it('falls back to blank entries when the var is unparseable', () => {
    setEnv('not json');

    expect(getFooterLinks().every(l => l.url === '' && l.name === '')).toBe(true);
  });
});
