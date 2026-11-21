import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forkChainId } from '@/utils/chainId';

const load = async () => await import('./forkChains');

describe('forkL2Chains', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
    vi.stubEnv('VITE_TESTNET_CONFIG', 'true');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', '');
  });

  it('adds every L2 of the named Tenderly environment to the dev build', async () => {
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', 'team/project/dev-env');
    const { forkL2Chains, forkL2ChainIds } = await load();
    expect(forkL2ChainIds).toEqual([
      forkChainId.base,
      forkChainId.arbitrum,
      forkChainId.optimism,
      forkChainId.unichain
    ]);
    expect(forkL2Chains.map(chain => chain.rpcUrls.default.http[0])).toEqual([
      'https://virtual.base.eu.rpc.tenderly.co/team/project/dev-env',
      'https://virtual.arbitrum.eu.rpc.tenderly.co/team/project/dev-env',
      'https://virtual.optimism.eu.rpc.tenderly.co/team/project/dev-env',
      'https://virtual.unichain.eu.rpc.tenderly.co/team/project/dev-env'
    ]);
  });

  it('adds none without the RPC name', async () => {
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', '');
    expect((await load()).forkL2ChainIds).toEqual([]);
  });

  it('adds none outside the dev config, even with the RPC name set', async () => {
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', 'team/project/dev-env');
    vi.stubEnv('VITE_TESTNET_CONFIG', 'false');
    expect((await load()).forkL2ChainIds).toEqual([]);
  });

  it('adds none in the mock wallet build', async () => {
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', 'team/project/dev-env');
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
    expect((await load()).forkL2ChainIds).toEqual([]);
  });
});
