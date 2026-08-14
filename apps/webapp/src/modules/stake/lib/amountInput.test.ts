import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { parseAmountInput, sanitizeAmountInput } from '@/lib/amountInput';
import { formatAmountForInput } from './amountInput';

describe('formatAmountForInput', () => {
  it('renders the exact amount with thousands grouping, empty for zero', () => {
    expect(formatAmountForInput(0n)).toBe('');
    expect(formatAmountForInput(parseUnits('100000', 18))).toBe('100,000');
    expect(formatAmountForInput(parseUnits('1250000', 18))).toBe('1,250,000');
    expect(formatAmountForInput(parseUnits('4.341234', 18))).toBe('4.341234');
  });

  it('round-trips through the shared amount mask', () => {
    const amount = parseUnits('65500.123456789', 18);
    const masked = sanitizeAmountInput(formatAmountForInput(amount), 18);
    expect(parseAmountInput(masked, 18)).toBe(amount);
  });

  it('caps the display decimals without rounding when asked (exact-max staging)', () => {
    const liveDebt = parseUnits('30000.242775147091945099', 18);
    expect(formatAmountForInput(liveDebt, 2)).toBe('30,000.24');
    expect(formatAmountForInput(parseUnits('500000', 18), 2)).toBe('500,000');
    // Trailing zeros inside the cap still trim.
    expect(formatAmountForInput(parseUnits('1.10001', 18), 2)).toBe('1.1');
  });
});
