import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import {
  normalizeDecimalSeparator,
  parseAmountInput,
  readPastedAmount,
  sanitizeAmountInput
} from './amountInput';

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

  it('reads a decimal comma as a decimal point (the iOS keypad key)', () => {
    expect(sanitizeAmountInput('1,5', 18)).toBe('1.5');
    expect(sanitizeAmountInput('0,', 18)).toBe('0.');
    expect(sanitizeAmountInput('1,9999999', 6)).toBe('1.999999');
  });

  it('preserves in-progress typing states', () => {
    expect(sanitizeAmountInput('', 18)).toBe('');
    expect(sanitizeAmountInput('.', 18)).toBe('.');
    expect(sanitizeAmountInput('1.', 18)).toBe('1.');
    expect(sanitizeAmountInput('0.0', 18)).toBe('0.0');
  });
});

describe('normalizeDecimalSeparator', () => {
  it('reads a lone comma as the decimal separator', () => {
    expect(normalizeDecimalSeparator('1,5')).toBe('1.5');
    expect(normalizeDecimalSeparator(',5')).toBe('.5');
  });

  it('drops a comma beside a dot — the dot is the point the mask already placed', () => {
    expect(normalizeDecimalSeparator('1,234.5')).toBe('1234.5');
    expect(normalizeDecimalSeparator('1.234,5')).toBe('1.2345');
  });

  it('never moves a decimal point already on screen (a second tap of the key)', () => {
    // The field re-renders masked, so "1,5" comes back as "1.5" and tapping the
    // keypad's decimal key again hands us "1.5,". Relocating the point there
    // would silently transact 15.
    expect(normalizeDecimalSeparator('1.5,')).toBe('1.5');
    expect(normalizeDecimalSeparator('0.5,')).toBe('0.5');
    expect(sanitizeAmountInput('1.5,', 18)).toBe('1.5');
    expect(sanitizeAmountInput('0.5,', 2)).toBe('0.5');
  });

  it('treats repeated commas as grouping — a number has only one decimal mark', () => {
    expect(normalizeDecimalSeparator('1,234,567')).toBe('1234567');
  });

  it('leaves comma-free text exactly as it is', () => {
    expect(normalizeDecimalSeparator('1.5')).toBe('1.5');
    expect(normalizeDecimalSeparator('')).toBe('');
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

describe('readPastedAmount', () => {
  it('reads an en-US grouped paste as grouping, not as the keypad decimal comma', () => {
    expect(readPastedAmount('100,000')).toBe('100000');
    expect(readPastedAmount('1,234.5')).toBe('1234.5');
    expect(readPastedAmount(' 123,456,789.999 ')).toBe('123456789.999');
  });

  it('leaves a paste that is not grouped for the mask, so a decimal comma still reads as the point', () => {
    expect(readPastedAmount('1,5')).toBe('1,5');
    expect(readPastedAmount('0,125')).toBe('0,125');
    expect(readPastedAmount('12.5')).toBe('12.5');
    expect(readPastedAmount('1000')).toBe('1000');
  });

  it('refuses a paste the mask would have to mangle', () => {
    expect(readPastedAmount('1e5')).toBeNull();
    expect(readPastedAmount('-5')).toBeNull();
    expect(readPastedAmount('$100')).toBeNull();
    expect(readPastedAmount('12abc')).toBeNull();
    expect(readPastedAmount('1_000')).toBeNull();
  });
});
