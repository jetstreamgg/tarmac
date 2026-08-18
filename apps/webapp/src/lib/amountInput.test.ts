import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { parseAmountInput, sanitizeAmountInput } from './amountInput';

describe('sanitizeAmountInput', () => {
  it('strips signs (negative amounts are unrepresentable)', () => {
    expect(sanitizeAmountInput('-5', 18)).toBe('5');
    expect(sanitizeAmountInput('+5', 18)).toBe('5');
  });

  it('strips exponent notation', () => {
    expect(sanitizeAmountInput('1e9', 18)).toBe('19');
    expect(sanitizeAmountInput('1E9', 18)).toBe('19');
  });

  it('keeps at most one decimal dot', () => {
    expect(sanitizeAmountInput('1.2.3', 18)).toBe('1.23');
    expect(sanitizeAmountInput('1.2', 18)).toBe('1.2');
  });

  it('caps the fraction at the token decimals', () => {
    expect(sanitizeAmountInput('1.9999999', 6)).toBe('1.999999');
    expect(sanitizeAmountInput('1.5', 0)).toBe('1');
  });

  it('strips group separators and other noise', () => {
    expect(sanitizeAmountInput('1,000.5', 18)).toBe('1000.5');
    expect(sanitizeAmountInput('abc12.34xyz', 18)).toBe('12.34');
    expect(sanitizeAmountInput(' 1 ', 18)).toBe('1');
  });

  it('preserves in-progress typing states', () => {
    expect(sanitizeAmountInput('', 18)).toBe('');
    expect(sanitizeAmountInput('.', 18)).toBe('.');
    expect(sanitizeAmountInput('1.', 18)).toBe('1.');
    expect(sanitizeAmountInput('0.0', 18)).toBe('0.0');
  });
});

describe('parseAmountInput', () => {
  it('parses masked text exactly — display always equals the transacted value', () => {
    expect(parseAmountInput('1.5', 18)).toBe(parseUnits('1.5', 18));
    expect(parseAmountInput('1.999999', 6)).toBe(parseUnits('1.999999', 6));
    expect(parseAmountInput('1.', 18)).toBe(parseUnits('1', 18));
    expect(parseAmountInput('.5', 18)).toBe(parseUnits('0.5', 18));
  });

  it('parses empty and bare-dot states to zero', () => {
    expect(parseAmountInput('', 18)).toBe(0n);
    expect(parseAmountInput('.', 18)).toBe(0n);
  });

  it('rejects text the mask could not have produced instead of guessing a nearby value', () => {
    // parseUnits would return a negative bigint for '-5' and round '1.9999999'
    // half-up to 2.000000 at 6 decimals — both must be 0n, never a surprise.
    expect(parseAmountInput('-5', 18)).toBe(0n);
    expect(parseAmountInput('1e9', 18)).toBe(0n);
    expect(parseAmountInput('1.2.3', 18)).toBe(0n);
    expect(parseAmountInput('1.9999999', 6)).toBe(0n);
    expect(parseAmountInput('1,000', 18)).toBe(0n);
  });
});
