import { describe, expect, it } from 'vitest';
import { sanitizeAmountInput } from '@/lib/amountInput';
import { verifySlippage } from './utils';

const config = { min: 0, max: 50, default: 0.5 };

describe('verifySlippage', () => {
  it('accepts in-bounds numbers and rejects everything else', () => {
    expect(verifySlippage('0.5', config)).toBe('0.5');
    expect(verifySlippage('60', config)).toBe('');
    expect(verifySlippage('abc', config)).toBe('');
    expect(verifySlippage('', config)).toBe('');
  });

  it('keeps an in-progress decimal point so the next digit is a fraction', () => {
    // What the iOS keypad's decimal key produces on its first tap under a
    // European locale: ',' → '.'. Blanking it would land ',5' (0.5%) as 5%.
    expect(verifySlippage(sanitizeAmountInput(',', 2), config)).toBe('.');
    expect(verifySlippage(sanitizeAmountInput(',5', 2), config)).toBe('.5');
  });

  it('does not move a decimal point already typed when the key is tapped again', () => {
    expect(verifySlippage(sanitizeAmountInput('0.5,', 2), config)).toBe('0.5');
  });
});
