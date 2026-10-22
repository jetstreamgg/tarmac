import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bridgeChainId, bridgeNetworkForChainId, guardChainId } from './networks';

describe('Tenderly L2 testnets', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK_WALLET', 'false'));
  afterEach(() => vi.unstubAllEnvs());

  it('pairs the Tenderly fork with the L2 testnets', () => {
    expect(bridgeChainId('ethereum', 314310)).toBe(314310);
    expect(bridgeChainId('base', 314310)).toBe(9998453);
    expect(bridgeChainId('arbitrum', 314310)).toBe(99942161);
    expect(guardChainId({ network: 'optimism', familyChainId: 314310, chainIds: [314310, 99910] })).toBe(
      99910
    );
  });

  it('keeps the real L2s with mainnet, and in the mock wallet build whose forks use real ids', () => {
    expect(bridgeChainId('base', 1)).toBe(8453);
    vi.stubEnv('VITE_USE_MOCK_WALLET', 'true');
    expect(bridgeChainId('base', 314310)).toBe(8453);
  });

  it('reads a wallet on an L2 testnet as that L2', () => {
    expect(bridgeNetworkForChainId(999130)).toBe('unichain');
    expect(bridgeNetworkForChainId(130)).toBe('unichain');
    expect(bridgeNetworkForChainId(314310)).toBe('ethereum');
  });
});

describe('guardChainId', () => {
  const chainIds = [1, 8453];

  it('pins the flow to the network when the app can switch to it', () => {
    expect(guardChainId({ network: 'base', familyChainId: 1, chainIds })).toBe(8453);
    expect(guardChainId({ network: 'ethereum', familyChainId: 1, chainIds })).toBe(1);
  });

  it('has no chain for networks the app cannot switch to, so nothing runs on the wallet chain instead', () => {
    expect(guardChainId({ network: 'arbitrum', familyChainId: 1, chainIds })).toBeUndefined();
    expect(guardChainId({ network: 'solana', familyChainId: 1, chainIds })).toBeUndefined();
  });
});
