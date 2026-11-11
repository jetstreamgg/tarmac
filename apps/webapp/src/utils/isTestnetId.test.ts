import { afterEach, describe, expect, it, vi } from 'vitest';
import { chainId, forkChainId } from './chainId';
import { familyMainnetId } from './isTestnetId';

const L2S = [chainId.base, chainId.arbitrum, chainId.optimism, chainId.unichain];

describe('familyMainnetId', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('anchors the family to mainnet on mainnet and its L2s', () => {
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
    expect(familyMainnetId(chainId.mainnet)).toBe(chainId.mainnet);
    for (const id of L2S) expect(familyMainnetId(id)).toBe(chainId.mainnet);
  });

  it('anchors the family to the Tenderly fork when connected to it', () => {
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
    expect(familyMainnetId(chainId.tenderly)).toBe(chainId.tenderly);
  });

  // The mock wallet build configures the Tenderly forks only, its L2s under their real ids.
  it('anchors the mock wallet build to the Tenderly fork from its L2s too', () => {
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
    expect(familyMainnetId(chainId.tenderly)).toBe(chainId.tenderly);
    for (const id of L2S) expect(familyMainnetId(id)).toBe(chainId.tenderly);
  });
});

describe('familyMainnetId on the multichain fork', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('anchors the fork L2s to the Ethereum fork', () => {
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'false');
    for (const id of Object.values(forkChainId)) expect(familyMainnetId(id)).toBe(chainId.tenderly);
  });
});
