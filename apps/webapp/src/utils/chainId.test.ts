import { describe, expect, it } from 'vitest';
import { chainId, forkChainId, isForkChainId, realChainId, withForkAliases } from './chainId';
describe('Contracts', () => {
  it('Should export the chainId definitions', () => {
    expect(chainId.mainnet).toBeDefined();
    expect(chainId.tenderly).toBeDefined();
  });
});

describe('Tenderly fork ids', () => {
  const pairs: [number, number][] = [
    [chainId.tenderly, chainId.mainnet],
    [forkChainId.base, chainId.base],
    [forkChainId.arbitrum, chainId.arbitrum],
    [forkChainId.optimism, chainId.optimism],
    [forkChainId.unichain, chainId.unichain]
  ];

  it('maps each fork to the chain it stands in for', () => {
    for (const [fork, real] of pairs) expect(realChainId(fork)).toBe(real);
  });

  it('leaves every other id unchanged', () => {
    for (const [, real] of pairs) expect(realChainId(real)).toBe(real);
    expect(realChainId(43114)).toBe(43114);
  });

  it('tells fork ids apart from real ones', () => {
    for (const [fork, real] of pairs) {
      expect(isForkChainId(fork)).toBe(true);
      expect(isForkChainId(real)).toBe(false);
    }
  });

  it('copies real L2 entries to their fork ids without overwriting fork entries', () => {
    const map = withForkAliases({
      [chainId.mainnet]: 'm',
      [chainId.tenderly]: 't',
      [chainId.base]: 'b',
      [chainId.arbitrum]: 'a',
      [forkChainId.arbitrum]: 'own'
    }) as Record<number, string>;
    expect(map[forkChainId.base]).toBe('b');
    expect(map[forkChainId.arbitrum]).toBe('own');
    expect(map[forkChainId.optimism]).toBeUndefined();
    expect(map[chainId.tenderly]).toBe('t');
    expect(map[chainId.base]).toBe('b');
  });
});
