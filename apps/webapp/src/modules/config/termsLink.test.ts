import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reportError = vi.fn();

vi.mock('@/modules/sentry/reportError', () => ({
  reportError
}));

describe('termsLink config helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    reportError.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the configured primary terms link', async () => {
    vi.stubEnv('VITE_TERMS_LINK', '[{"name":"Terms of Use","url":"https://example.com/terms"}]');

    const { getTermsLinkConfig } = await import('./termsLink');

    expect(getTermsLinkConfig().primaryTermsLink).toEqual({
      name: 'Terms of Use',
      url: 'https://example.com/terms'
    });
  });

  it('reports parse failures once per context', async () => {
    vi.stubEnv('VITE_TERMS_LINK', 'not-json');

    const { reportTermsLinkConfigErrorOnce } = await import('./termsLink');
    const ctx = {
      module: 'widgets',
      flow: 'seal',
      action: 'parse-terms-link',
      type: 'config_error'
    } as const;

    reportTermsLinkConfigErrorOnce(ctx);
    reportTermsLinkConfigErrorOnce(ctx);

    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('reports missing terms links once per context', async () => {
    vi.stubEnv('VITE_TERMS_LINK', '[]');

    const { reportMissingTermsLinkOnce } = await import('./termsLink');
    const ctx = {
      module: 'widgets',
      flow: 'seal',
      action: 'load-terms-link',
      type: 'missing_terms_link'
    } as const;

    reportMissingTermsLinkOnce(ctx);
    reportMissingTermsLinkOnce(ctx);

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('deduplicates config and missing-link reports independently', async () => {
    vi.stubEnv('VITE_TERMS_LINK', 'not-json');

    const { reportMissingTermsLinkOnce, reportTermsLinkConfigErrorOnce } = await import('./termsLink');
    const ctx = {
      module: 'widgets',
      flow: 'seal',
      action: 'terms-link-error',
      type: 'config_error'
    } as const;

    reportTermsLinkConfigErrorOnce(ctx);
    reportMissingTermsLinkOnce(ctx);

    expect(reportError).toHaveBeenCalledTimes(2);
  });
});
