import { describe, expect, it } from 'vitest';
import { allowedDestinations, isAllowedPair, pickFrom, pickTo } from './pairs';

describe('bridge pairs', () => {
  it('Ethereum reaches every other network', () => {
    expect(allowedDestinations('ethereum')).toEqual([
      'base',
      'arbitrum',
      'optimism',
      'unichain',
      'avalanche',
      'solana'
    ]);
  });

  it('every other network only reaches Ethereum (no L2 to L2)', () => {
    for (const from of ['base', 'arbitrum', 'optimism', 'unichain', 'avalanche', 'solana'] as const) {
      expect(allowedDestinations(from)).toEqual(['ethereum']);
    }
    expect(isAllowedPair({ from: 'base', to: 'arbitrum' })).toBe(false);
  });

  it('picking the current destination as source swaps the sides', () => {
    expect(pickFrom({ from: 'ethereum', to: 'base' }, 'base')).toEqual({ from: 'base', to: 'ethereum' });
    expect(pickTo({ from: 'base', to: 'ethereum' }, 'base')).toEqual({ from: 'ethereum', to: 'base' });
  });

  it('moving the source off Ethereum forces the destination to Ethereum', () => {
    expect(pickFrom({ from: 'ethereum', to: 'base' }, 'arbitrum')).toEqual({
      from: 'arbitrum',
      to: 'ethereum'
    });
  });

  it('moving the source back to Ethereum picks the first destination', () => {
    expect(pickFrom({ from: 'base', to: 'ethereum' }, 'ethereum')).toEqual({ from: 'ethereum', to: 'base' });
  });

  it('picking an L2 destination from another L2 moves the source to Ethereum', () => {
    expect(pickTo({ from: 'base', to: 'ethereum' }, 'arbitrum')).toEqual({
      from: 'ethereum',
      to: 'arbitrum'
    });
  });
});
