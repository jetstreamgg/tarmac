import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldSkipAuthChecks } from './authCheck';
import { isPrivateDeployment } from './isPrivateDeployment';

// IS_PRODUCTION_ENV is fixed at import time from VITE_ENV_NAME; routing it
// through a mutable holder lets each test pick the build flavor.
const env = { production: false };
vi.mock('@/lib/constants', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/constants')>()),
  get IS_PRODUCTION_ENV() {
    return env.production;
  }
}));

vi.mock('./isPrivateDeployment', () => ({ isPrivateDeployment: vi.fn(() => false) }));

describe('shouldSkipAuthChecks', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    env.production = false;
    vi.mocked(isPrivateDeployment).mockReturnValue(false);
    delete window.__FORCE_AUTH_CHECKS__;
  });

  it('skips on the env flag outside production', () => {
    vi.stubEnv('VITE_SKIP_AUTH_CHECK', 'true');
    expect(shouldSkipAuthChecks()).toBe(true);
  });

  it('the e2e seam cancels the env-flag skip', () => {
    vi.stubEnv('VITE_SKIP_AUTH_CHECK', 'true');
    window.__FORCE_AUTH_CHECKS__ = true;
    expect(shouldSkipAuthChecks()).toBe(false);
  });

  it('the seam is inert in production — the verdict is already fixed', () => {
    env.production = true;
    vi.stubEnv('VITE_SKIP_AUTH_CHECK', 'true');
    expect(shouldSkipAuthChecks()).toBe(false);
    window.__FORCE_AUTH_CHECKS__ = true;
    expect(shouldSkipAuthChecks()).toBe(false);
  });

  it('the seam never cancels a private deployment', () => {
    vi.mocked(isPrivateDeployment).mockReturnValue(true);
    window.__FORCE_AUTH_CHECKS__ = true;
    expect(shouldSkipAuthChecks()).toBe(true);
  });

  it('runs the checks when the env flag is off', () => {
    // Stubbed explicitly: the test runner itself inherits the dev .env, which
    // sets VITE_SKIP_AUTH_CHECK=true.
    vi.stubEnv('VITE_SKIP_AUTH_CHECK', 'false');
    expect(shouldSkipAuthChecks()).toBe(false);
  });
});
