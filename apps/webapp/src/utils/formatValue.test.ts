import { describe, expect, it } from 'vitest';
import { formatBigInt, formatPercent } from './formatValue';

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
