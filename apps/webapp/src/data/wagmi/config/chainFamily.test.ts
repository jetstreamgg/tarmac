import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chainId, forkChainId } from '@/utils/chainId';

const FORK_FAMILY = [chainId.tenderly, ...Object.values(forkChainId)];

const load = async () => (await import('./chainFamily')).getSupportedChainIds;

describe('getSupportedChainIds', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', '');
  });

  const stubForkRpcs = () => {
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
    vi.stubEnv('VITE_TESTNET_CONFIG', 'true');
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', 'team/project/dev-env');
  };

  it('returns the whole fork family from any fork chain', async () => {
    stubForkRpcs();
    const getSupportedChainIds = await load();
    for (const id of FORK_FAMILY) expect(getSupportedChainIds(id)).toEqual(FORK_FAMILY);
  });

  it('keeps the production family on production chains', async () => {
    stubForkRpcs();
    const getSupportedChainIds = await load();
    expect(getSupportedChainIds(chainId.base)).toEqual([
      chainId.mainnet,
      chainId.base,
      chainId.arbitrum,
      chainId.optimism,
      chainId.unichain
    ]);
  });

  it('keeps to the Ethereum fork without the RPC name', async () => {
    stubForkRpcs();
    vi.stubEnv('VITE_TENDERLY_RPC_NAME', '');
    const getSupportedChainIds = await load();
    expect(getSupportedChainIds(chainId.tenderly)).toEqual([chainId.tenderly]);
  });

  it('keeps the mock wallet build on the Ethereum fork alone', async () => {
    stubForkRpcs();
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
    const getSupportedChainIds = await load();
    expect(getSupportedChainIds(chainId.tenderly)).toEqual([chainId.tenderly]);
  });
});
