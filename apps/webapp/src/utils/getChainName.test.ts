import { describe, expect, it } from 'vitest';
import { forkChainId } from './chainId';
import { getChainName } from './getChainName';

describe('getChainName', () => {
  it('names each fork L2 after the L2 it stands in for', () => {
    expect(getChainName(forkChainId.base)).toBe('Base');
    expect(getChainName(forkChainId.arbitrum)).toBe('Arbitrum');
    expect(getChainName(forkChainId.optimism)).toBe('Optimism');
    expect(getChainName(forkChainId.unichain)).toBe('Unichain');
  });
});
