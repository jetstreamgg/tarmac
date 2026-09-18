import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { parseAmountInput } from '@/lib/amountInput';
import { formatAmountForInput, groupAmountInput, ungroupAmountInput } from './amountInput';

describe('formatAmountForInput', () => {
  it('renders the exact amount as plain digits, empty for zero', () => {
    expect(formatAmountForInput(0n)).toBe('');
    expect(formatAmountForInput(parseUnits('100000', 18))).toBe('100000');
    expect(formatAmountForInput(parseUnits('1250000', 18))).toBe('1250000');
    expect(formatAmountForInput(parseUnits('4.341234', 18))).toBe('4.341234');
  });

  it('round-trips through parseAmountInput', () => {
    const amount = parseUnits('65500.123456789', 18);
    expect(parseAmountInput(formatAmountForInput(amount), 18)).toBe(amount);
  });

  it('caps the display decimals without rounding when asked (exact-max staging)', () => {
    const liveDebt = parseUnits('30000.242775147091945099', 18);
    expect(formatAmountForInput(liveDebt, 2)).toBe('30000.24');
    expect(formatAmountForInput(parseUnits('500000', 18), 2)).toBe('500000');
    // Trailing zeros inside the cap still trim.
    expect(formatAmountForInput(parseUnits('1.10001', 18), 2)).toBe('1.1');
  });
});

describe('groupAmountInput / ungroupAmountInput', () => {
  it('groups the integer part and leaves the fraction alone', () => {
    expect(groupAmountInput('')).toBe('');
    expect(groupAmountInput('500')).toBe('500');
    expect(groupAmountInput('1764049')).toBe('1,764,049');
    expect(groupAmountInput('17640.49')).toBe('17,640.49');
    expect(groupAmountInput('1000.')).toBe('1,000.');
    expect(groupAmountInput('0.123456')).toBe('0.123456');
  });

  it('strips grouping commas but keeps a keypad decimal comma', () => {
    expect(ungroupAmountInput('1,764,049')).toBe('1764049');
    expect(ungroupAmountInput('17,640.49')).toBe('17640.49');
    // The field showed "1,764" and the user typed a 5 after it.
    expect(ungroupAmountInput('1,7645')).toBe('17645');
    expect(ungroupAmountInput('1,5')).toBe('1,5');
    expect(ungroupAmountInput('1,50')).toBe('1,50');
  });

  it('round-trips a masked amount through the display text', () => {
    for (const text of ['1764049', '17640.49', '1000.', '12']) {
      expect(ungroupAmountInput(groupAmountInput(text))).toBe(text);
    }
  });
});
