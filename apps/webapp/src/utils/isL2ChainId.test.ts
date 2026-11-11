import { describe, expect, it } from 'vitest';
import { chainId, forkChainId } from './chainId';
import {
  isArbitrumChainId,
  isBaseChainId,
  isL2ChainId,
  isOptimismChainId,
  isUnichainChainId
} from './isL2ChainId';

describe('isL2ChainId', () => {
  it('reads each fork L2 as the L2 it stands in for', () => {
    expect(isBaseChainId(forkChainId.base)).toBe(true);
    expect(isArbitrumChainId(forkChainId.arbitrum)).toBe(true);
    expect(isOptimismChainId(forkChainId.optimism)).toBe(true);
    expect(isUnichainChainId(forkChainId.unichain)).toBe(true);
    for (const id of Object.values(forkChainId)) expect(isL2ChainId(id)).toBe(true);
  });

  it('keeps Ethereum and its fork out of the L2s', () => {
    expect(isL2ChainId(chainId.mainnet)).toBe(false);
    expect(isL2ChainId(chainId.tenderly)).toBe(false);
  });
});
