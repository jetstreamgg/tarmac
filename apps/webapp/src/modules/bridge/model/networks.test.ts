import { describe, expect, it } from 'vitest';
import { guardChainId } from './networks';

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
