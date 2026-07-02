import { describe, expect, it } from 'vitest';
import { formatBigInt, formatPercent, splitAmount } from './formatValue';

describe('Risk parameter math functions using ETH-A risk parameters', () => {
  it('Format a number as a "wad" by default', () => {
    const wad = formatBigInt(1892153672645000000000n, { locale: 'en' });
    expect(wad).toBe('1,892');
  });

  it('Format a number as a "ray"', () => {
    const wad = formatBigInt(543210000000000000000000000000n, { locale: 'en', unit: 'ray' });
    expect(wad).toBe('543.21');
  });

  it('Format a "wad" as a percent', () => {
    const wad = formatPercent(123456789000000000n, { locale: 'en' });
    expect(wad).toBe('12.35%');
  });

  it('Format a "ray" as a percent', () => {
    const wad = formatPercent(987654321000000000000000000n, { locale: 'en', unit: 'ray' });
    expect(wad).toBe('98.77%');
  });
});

describe('splitAmount', () => {
  it('splits the grouped integer and trailing fraction', () => {
    expect(splitAmount(100000.00026)).toEqual({ whole: '100,000', fraction: '00026' });
  });

  it('returns an empty fraction for whole numbers', () => {
    expect(splitAmount(42)).toEqual({ whole: '42', fraction: '' });
  });

  it('trims trailing zeros from the fraction', () => {
    expect(splitAmount(12.5)).toEqual({ whole: '12', fraction: '5' });
  });

  it('carries a rounded-up fraction into the whole part', () => {
    // The 5-digit fraction of 0.999996 rounds to a full unit → 1, not 0.1.
    expect(splitAmount(0.999996)).toEqual({ whole: '1', fraction: '' });
    expect(splitAmount(1.999996)).toEqual({ whole: '2', fraction: '' });
  });
});
