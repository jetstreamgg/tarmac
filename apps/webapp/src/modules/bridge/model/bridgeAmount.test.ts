import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { bridgedAmount, formatExactUsds } from './bridgeAmount';

const usds = (value: string) => parseUnits(value, 18);

describe('formatExactUsds', () => {
  it('keeps every decimal typed', () => {
    expect(formatExactUsds(usds('0.0123'))).toBe('0.0123');
    expect(formatExactUsds(usds('1.123456789012345678'))).toBe('1.123456789012345678');
  });

  it('pads to two decimals and groups the whole part', () => {
    expect(formatExactUsds(0n)).toBe('0.00');
    expect(formatExactUsds(usds('12'))).toBe('12.00');
    expect(formatExactUsds(usds('1234567.5'))).toBe('1,234,567.50');
  });

  it('never rounds a dust amount away', () => {
    expect(formatExactUsds(1n)).toBe('0.000000000000000001');
  });
});

describe('bridgedAmount', () => {
  it('is the amount typed on a native route', () => {
    expect(bridgedAmount(usds('1.1234567'), 'native')).toBe(usds('1.1234567'));
  });

  it('drops only what is below one USDC unit on CCTP', () => {
    expect(bridgedAmount(usds('1.1234567'), 'cctp')).toBe(usds('1.123456'));
    expect(bridgedAmount(usds('0.0123'), 'cctp')).toBe(usds('0.0123'));
  });

  it('is the amount typed while no route is known', () => {
    expect(bridgedAmount(usds('1.1234567'), undefined)).toBe(usds('1.1234567'));
  });
});
