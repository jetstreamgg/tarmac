import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const load = async () => (await import('./testnetConfig')).USE_TESTNET_CONFIG;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('MODE', 'production');
  vi.stubEnv('VITE_TESTNET_CONFIG', '');
});
afterEach(() => vi.unstubAllEnvs());

it('uses the dev config in a testnet build', async () => {
  vi.stubEnv('VITE_TESTNET_CONFIG', 'true');
  expect(await load()).toBe(true);
});

it('uses the dev config under vite dev', async () => {
  vi.stubEnv('MODE', 'development');
  expect(await load()).toBe(true);
});

it('uses the mainnet config in any other build', async () => {
  expect(await load()).toBe(false);
});
