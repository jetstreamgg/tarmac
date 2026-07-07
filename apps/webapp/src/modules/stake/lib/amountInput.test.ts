import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { formatAmountForInput, parseAmountText, sanitizeAmountText } from './amountInput';

describe('sanitizeAmountText', () => {
  it('keeps digits, one dot, and thousands separators', () => {
    expect(sanitizeAmountText('100,000.00')).toBe('100,000.00');
    expect(sanitizeAmountText('abc12.3.4')).toBe('12.34');
    expect(sanitizeAmountText('')).toBe('');
  });
});

describe('parseAmountText', () => {
  it('parses plain and comma-grouped decimals to 18-decimal bigints', () => {
    expect(parseAmountText('100,000')).toBe(parseUnits('100000', 18));
    expect(parseAmountText('1.5')).toBe(parseUnits('1.5', 18));
    expect(parseAmountText('')).toBe(0n);
    expect(parseAmountText('.')).toBe(0n);
  });
});

describe('formatAmountForInput', () => {
  it('renders the exact amount with thousands grouping, empty for zero', () => {
    expect(formatAmountForInput(0n)).toBe('');
    expect(formatAmountForInput(parseUnits('100000', 18))).toBe('100,000');
    expect(formatAmountForInput(parseUnits('1250000', 18))).toBe('1,250,000');
    expect(formatAmountForInput(parseUnits('4.341234', 18))).toBe('4.341234');
  });

  it('round-trips through parseAmountText', () => {
    const amount = parseUnits('65500.123456789', 18);
    expect(parseAmountText(formatAmountForInput(amount))).toBe(amount);
  });
});
