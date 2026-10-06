import { describe, expect, it } from 'vitest';
import { guardChainId } from './networks';

describe('guardChainId', () => {
  const chainIds = [1, 8453];

  it('pins the flow to the network when the app can switch to it', () => {
    expect(guardChainId({ network: 'base', familyChainId: 1, chainIds, walletChainId: 1 })).toBe(8453);
    expect(guardChainId({ network: 'ethereum', familyChainId: 1, chainIds, walletChainId: 8453 })).toBe(1);
  });

  it('falls back to the wallet chain for networks the app has no chain for', () => {
    expect(guardChainId({ network: 'arbitrum', familyChainId: 1, chainIds, walletChainId: 1 })).toBe(1);
    expect(guardChainId({ network: 'solana', familyChainId: 1, chainIds, walletChainId: 8453 })).toBe(8453);
  });
});
