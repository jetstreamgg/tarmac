import { describe, expect, it } from 'vitest';
import { sanitizeAmountInput } from '@/lib/amountInput';
import { verifyPendleSlippage } from './utils';

const config = { min: 0, max: 50 };

describe('verifyPendleSlippage', () => {
  it('clamps to the configured bounds and rejects non-numeric text', () => {
    expect(verifyPendleSlippage('0.5', config)).toBe('0.5');
    expect(verifyPendleSlippage('60', config)).toBe('50');
    expect(verifyPendleSlippage('abc', config)).toBe('');
    expect(verifyPendleSlippage('', config)).toBe('');
  });

  it('keeps an in-progress decimal point so the next digit is a fraction', () => {
    // What the iOS keypad's decimal key produces on its first tap under a
    // European locale: ',' → '.'. Blanking it would land ',5' (0.5%) as 5%.
    expect(verifyPendleSlippage(sanitizeAmountInput(',', 2), config)).toBe('.');
    expect(verifyPendleSlippage(sanitizeAmountInput(',5', 2), config)).toBe('.5');
  });

  it('does not move a decimal point already typed when the key is tapped again', () => {
    expect(verifyPendleSlippage(sanitizeAmountInput('0.5,', 2), config)).toBe('0.5');
  });
});
