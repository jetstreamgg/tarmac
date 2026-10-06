import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import posthog from 'posthog-js';

// posthog-js is mocked globally in src/test/setup.ts (init is a vi.fn()).
// The module initializes at import time, so every case re-imports a fresh copy.

const setWebdriver = (value: boolean) =>
  Object.defineProperty(navigator, 'webdriver', { value, configurable: true });

describe('PostHogProvider init', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv('VITE_POSTHOG_ENABLED', 'true');
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (navigator as { webdriver?: boolean }).webdriver;
  });

  it('initializes with the crawlers the built-in blocklist misses', async () => {
    setWebdriver(false);
    await import('./PostHogProvider');
    expect(posthog.init).toHaveBeenCalledTimes(1);
    const [, config] = (posthog.init as Mock).mock.calls[0];
    expect(config.custom_blocked_useragents).toEqual(['aiwebindex', 'sogou web spider']);
  });

  it('does not initialize in an automated browser', async () => {
    setWebdriver(true);
    await import('./PostHogProvider');
    expect(posthog.init).not.toHaveBeenCalled();
  });
});
