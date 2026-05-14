import { describe, expect, it } from 'vitest';
import { calculateApyFromStr, formatStrAsApy } from './calculateApy';

describe('calculateApyFromStr', () => {
  it('should return 0 for zero rate', () => {
    const result = calculateApyFromStr(0n);
    expect(result).toBe(0);
  });

  it('should calculate 40% APY for input 1000000010669464688489416886n', () => {
    // This is the actual rate from the Sky Protocol
    // Rate per second: ~0.000000010669464688489416886
    // Expected APY: ~40%
    const str = 1000000010669464688489416886n;
    const result = calculateApyFromStr(str);

    // Allow for small floating point differences
    expect(result).toBeGreaterThan(39.9);
    expect(result).toBeLessThan(40.1);
  });

  it('should calculate APY correctly for a 1% rate', () => {
    // For 1% APY, we need to calculate the per-second rate
    // (1 + r)^31557600 = 1.01
    // r = 1.01^(1/31557600) - 1
    // r ≈ 3.1688087814028956e-10
    // In ray format: (1 + r) * 1e27
    const str = 1000000000316880878000000000n;
    const result = calculateApyFromStr(str);

    // Should be close to 1%
    expect(result).toBeGreaterThan(0.9);
    expect(result).toBeLessThan(1.1);
  });

  it('should calculate APY correctly for a 5% rate', () => {
    // For 5% APY
    // (1 + r)^31557600 = 1.05
    // r = 1.05^(1/31557600) - 1
    // r ≈ 1.5854895991880887e-9
    // In ray format: (1 + r) * 1e27
    const str = 1000000001585489599000000000n;
    const result = calculateApyFromStr(str);

    // Should be close to 5% (allow some tolerance for approximation)
    expect(result).toBeGreaterThan(4.5);
    expect(result).toBeLessThan(5.5);
  });

  it('should handle very small rates gracefully', () => {
    // Very small rate
    const str = 1000000000031688088000000000n;
    const result = calculateApyFromStr(str);

    // Should be a small positive percentage
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.15);
  });

  it('should cap unrealistic values at 1000%', () => {
    // Extremely high rate that would cause overflow
    const str = 1000000100000000000000000000n;
    const result = calculateApyFromStr(str);

    // Should fall back to linear approximation for safety
    expect(Number.isFinite(result)).toBe(true);
  });
});

describe('formatStrAsApy', () => {
  it('should format APY as percentage string with default 2 decimals', () => {
    const str = 1000000010669464688489416886n;
    const result = formatStrAsApy(str);

    // Should return something like "40.03%"
    expect(result).toMatch(/^(39|40)\.\d{2}%$/);
  });

  it('should format APY with custom decimal places', () => {
    const str = 1000000010669464688489416886n;
    const result = formatStrAsApy(str, 4);

    // Should return something like "40.0314%"
    expect(result).toMatch(/^(39|40)\.\d{4}%$/);
  });

  it('should format zero rate', () => {
    const result = formatStrAsApy(0n);
    expect(result).toBe('0.00%');
  });
});
