import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { formatBigInt, formatDecimalPercentage, formatPercent, formatUsd, splitAmount } from './formatValue';

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

describe('formatBigInt magnitude-driven decimals', () => {
  it('keeps 4 decimals under 10 — sub-cent prices survive', () => {
    expect(formatBigInt(parseUnits('0.0025', 18), { locale: 'en' })).toBe('0.0025');
    expect(formatBigInt(parseUnits('9.1234', 18), { locale: 'en' })).toBe('9.1234');
  });

  it('drops to 2 decimals between 10 and 1000, and 0 above', () => {
    expect(formatBigInt(parseUnits('10.1234', 18), { locale: 'en' })).toBe('10.12');
    expect(formatBigInt(parseUnits('999.995', 18), { locale: 'en' })).toBe('1,000');
    expect(formatBigInt(parseUnits('1234.56', 18), { locale: 'en' })).toBe('1,235');
  });

  it('clamps values under half the smallest step to a "<" indicator', () => {
    expect(formatBigInt(parseUnits('0.000049', 18), { locale: 'en' })).toBe('<0.0001');
    // At exactly half the step the clamp does not trigger.
    expect(formatBigInt(parseUnits('0.00005', 18), { locale: 'en' })).toBe('0.0001');
  });

  it('honors an explicit maxDecimals above the magnitude default', () => {
    // The price displays pin 4 decimals so they hold across the $10 boundary.
    expect(formatBigInt(parseUnits('10.1234', 18), { locale: 'en', unit: 18, maxDecimals: 4 })).toBe(
      '10.1234'
    );
  });

  it('pads trailing zeros when minDecimals is set — confirm-screen heroes', () => {
    expect(formatBigInt(parseUnits('10000', 18), { locale: 'en', minDecimals: 2, maxDecimals: 2 })).toBe(
      '10,000.00'
    );
    expect(formatBigInt(parseUnits('249.75', 18), { locale: 'en', minDecimals: 2, maxDecimals: 2 })).toBe(
      '249.75'
    );
    // A lone minDecimals wins over the magnitude-derived max (0 above 1000).
    expect(formatBigInt(parseUnits('1234.5', 18), { locale: 'en', minDecimals: 2 })).toBe('1,234.50');
  });
});

describe('formatUsd', () => {
  it('always renders exactly 2 decimals with the sign before the symbol', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(-100)).toBe('-$100.00');
  });

  it('renders sub-cent values as $0.00 with no indicator', () => {
    expect(formatUsd(0.004)).toBe('$0.00');
  });
});

describe('formatDecimalPercentage', () => {
  it('multiplies a decimal fraction by 100 at 2 decimals, keeping the sign', () => {
    expect(formatDecimalPercentage(0.0768)).toBe('7.68%');
    expect(formatDecimalPercentage(-0.0532)).toBe('-5.32%');
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
