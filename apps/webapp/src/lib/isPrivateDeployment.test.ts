import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadWithEnv(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) {
    vi.stubEnv('VITE_PRIVATE_HOSTNAMES', '');
  } else {
    vi.stubEnv('VITE_PRIVATE_HOSTNAMES', value);
  }
  const mod = await import('./isPrivateDeployment');
  return mod.isPrivateDeployment;
}

describe('isPrivateDeployment', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true
    });
    vi.unstubAllEnvs();
  });

  const setHostname = (hostname: string) => {
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, hostname },
      writable: true,
      configurable: true
    });
  };

  it('returns false when VITE_PRIVATE_HOSTNAMES is unset', async () => {
    setHostname('app-private.sky.money');
    const isPrivateDeployment = await loadWithEnv(undefined);
    expect(isPrivateDeployment()).toBe(false);
  });

  it('returns true when the current hostname matches the configured value', async () => {
    setHostname('app-private.sky.money');
    const isPrivateDeployment = await loadWithEnv('app-private.sky.money');
    expect(isPrivateDeployment()).toBe(true);
  });

  it('supports multiple hostnames via comma-separated list', async () => {
    const isPrivateDeployment = await loadWithEnv('app-private.sky.money, staging-private.sky.money');

    setHostname('staging-private.sky.money');
    expect(isPrivateDeployment()).toBe(true);

    setHostname('app-private.sky.money');
    expect(isPrivateDeployment()).toBe(true);
  });

  it('returns false for non-private hostnames', async () => {
    const isPrivateDeployment = await loadWithEnv('app-private.sky.money');
    setHostname('app.sky.money');
    expect(isPrivateDeployment()).toBe(false);
  });

  it('ignores whitespace and empty entries in the env var', async () => {
    const isPrivateDeployment = await loadWithEnv('  ,app-private.sky.money ,  ');
    setHostname('app-private.sky.money');
    expect(isPrivateDeployment()).toBe(true);
  });
});
