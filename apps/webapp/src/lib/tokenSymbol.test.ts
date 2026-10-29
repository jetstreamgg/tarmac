import { describe, expect, it } from 'vitest';
import { toTokenSymbol } from './tokenSymbol';

describe('toTokenSymbol', () => {
  it('passes a string symbol through', () => {
    expect(toTokenSymbol('MORPHO')).toBe('MORPHO');
  });

  it('turns anything else into an empty symbol', () => {
    for (const value of [123, {}, null, undefined, ['USDS']]) {
      expect(toTokenSymbol(value)).toBe('');
    }
  });
});
