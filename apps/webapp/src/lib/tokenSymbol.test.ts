import { describe, expect, it } from 'vitest';
import { toTokenLabel, toTokenSymbol } from './tokenSymbol';

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

describe('toTokenLabel', () => {
  const address = '0x58D97B57BB95320F9a05dC918Aef65434969c2B2';

  it('prefers the symbol', () => {
    expect(toTokenLabel('MORPHO', address)).toBe('MORPHO');
  });

  it('falls back to the shortened address for a missing or non-string symbol', () => {
    for (const symbol of ['', 123, {}, null, undefined]) {
      expect(toTokenLabel(symbol, address)).toBe('0x58...c2B2');
    }
  });
});
