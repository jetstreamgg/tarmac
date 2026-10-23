import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chainId, forkChainId } from '@/utils/chainId';

const L2_RPCS = ['BASE', 'ARBITRUM', 'OPTIMISM', 'UNICHAIN'];
const FORK_FAMILY = [chainId.tenderly, ...Object.values(forkChainId)];

const load = async () => (await import('./chainFamily')).getSupportedChainIds;

describe('getSupportedChainIds', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllEnvs());

  const stubForkRpcs = () => {
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
    for (const l2 of L2_RPCS) vi.stubEnv(`VITE_RPC_PROVIDER_TENDERLY_${l2}`, `https://fork-${l2}.invalid`);
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

  it('leaves out the fork L2s without an RPC', async () => {
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
    vi.stubEnv('VITE_RPC_PROVIDER_TENDERLY_BASE', 'https://fork-base.invalid');
    for (const l2 of L2_RPCS.slice(1)) vi.stubEnv(`VITE_RPC_PROVIDER_TENDERLY_${l2}`, '');
    const getSupportedChainIds = await load();
    expect(getSupportedChainIds(chainId.tenderly)).toEqual([chainId.tenderly, forkChainId.base]);
  });

  it('keeps the mock wallet build on the Ethereum fork alone', async () => {
    for (const l2 of L2_RPCS) vi.stubEnv(`VITE_RPC_PROVIDER_TENDERLY_${l2}`, `https://fork-${l2}.invalid`);
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
    const getSupportedChainIds = await load();
    expect(getSupportedChainIds(chainId.tenderly)).toEqual([chainId.tenderly]);
  });
});
