import { expect, it, vi } from 'vitest';
import hooksConfig from '../../vitest.hooks.config';

// The vnet hooks suite also holds tests that mock useChainId to chain 1 and expect mainnet reads.
it('runs the hooks suite with chain 1 as mainnet and no fork L2s, whatever the local .env holds', async () => {
  vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
  vi.stubEnv('VITE_TENDERLY_RPC_NAME', 'team/project/rpc');
  vi.stubEnv('VITE_TESTNET_CONFIG', 'true');
  for (const [key, value] of Object.entries(hooksConfig.test?.env ?? {})) vi.stubEnv(key, String(value));
  expect(hooksConfig.test?.setupFiles?.[0]).toBe('./src/test/blankForkEnv.ts');
  vi.resetModules();
  await import('./blankForkEnv');

  const { familyMainnetId } = await import('@/utils');
  const { forkL2ChainIds } = await import('@/data/wagmi/config/forkChains');
  expect(familyMainnetId(1)).toBe(1);
  expect(forkL2ChainIds).toEqual([]);
});
