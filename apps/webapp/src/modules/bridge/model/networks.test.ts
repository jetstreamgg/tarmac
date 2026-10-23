import { describe, expect, it } from 'vitest';
import { forkChainId } from '@/utils/chainId';
import { bridgeChainId, bridgeNetworkForChainId, guardChainId } from './networks';

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

describe('the Tenderly fork L2s', () => {
  it('read a fork L2 wallet chain as its network', () => {
    expect(bridgeNetworkForChainId(forkChainId.base)).toBe('base');
    expect(bridgeNetworkForChainId(forkChainId.arbitrum)).toBe('arbitrum');
    expect(bridgeNetworkForChainId(forkChainId.optimism)).toBe('optimism');
    expect(bridgeNetworkForChainId(forkChainId.unichain)).toBe('unichain');
  });

  it('transacts on the fork L2 in the fork family when the app has it', () => {
    expect(bridgeChainId('base', 314310, [forkChainId.base])).toBe(forkChainId.base);
    expect(
      guardChainId({ network: 'base', familyChainId: 314310, chainIds: [314310, forkChainId.base] })
    ).toBe(forkChainId.base);
  });

  it('keeps the real L2 ids on mainnet and when the fork has no such L2 (mock build)', () => {
    expect(bridgeChainId('base', 1, [forkChainId.base])).toBe(8453);
    expect(bridgeChainId('base', 314310, [])).toBe(8453);
  });
});
