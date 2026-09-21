import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { parseAmountInput } from '@/lib/amountInput';
import {
  caretAfterCharacters,
  formatAmountForInput,
  groupAmountInput,
  ungroupAmountInput
} from './amountInput';

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
    expect(ungroupAmountInput('1,764,049', '1,764,049')).toBe('1764049');
    expect(ungroupAmountInput('17,640.49', '17,640.49')).toBe('17640.49');
    // The field showed "1,764" and the user typed a 5 after it.
    expect(ungroupAmountInput('1,7645', '1,764')).toBe('17645');
    expect(ungroupAmountInput('1,5', '1')).toBe('1,5');
  });

  it('keeps a deleted or replaced group from turning into a fraction', () => {
    // Backspace on the last digit: the field's commas stay grouping.
    expect(ungroupAmountInput('123,456,78', '123,456,789')).toBe('12345678');
    expect(ungroupAmountInput('123,456,789.9', '123,456,789.99')).toBe('123456789.9');
    expect(ungroupAmountInput('123,456,789.', '123,456,789.9')).toBe('123456789.');
    // Selection deletes in the middle and at the start.
    expect(ungroupAmountInput('123,,789.99', '123,456,789.99')).toBe('123789.99');
    expect(ungroupAmountInput('123,789.99', '123,456,789.99')).toBe('123789.99');
    expect(ungroupAmountInput('3,456,789.99', '123,456,789.99')).toBe('3456789.99');
    // Select-and-replace a group.
    expect(ungroupAmountInput('123,9,789', '123,456,789')).toBe('1239789');
    // A pasted grouped figure keeps its commas for the mask to read as grouping.
    expect(ungroupAmountInput('1,234,567', '')).toBe('1,234,567');
  });

  it('places the caret after the same character once the text is regrouped', () => {
    expect(caretAfterCharacters('12,345,678', 3)).toBe(4);
    expect(caretAfterCharacters('123,789.99', 3)).toBe(3);
    expect(caretAfterCharacters('123,789.99', 3, true)).toBe(4);
    expect(caretAfterCharacters('1,245,678', 2, true)).toBe(3);
    expect(caretAfterCharacters('1.', 1, true)).toBe(2);
    expect(caretAfterCharacters('3,456,789.99', 0)).toBe(0);
    expect(caretAfterCharacters('1,000', 9)).toBe(5);
  });

  it('round-trips a masked amount through the display text', () => {
    for (const text of ['1764049', '17640.49', '1000.', '12']) {
      expect(ungroupAmountInput(groupAmountInput(text), groupAmountInput(text))).toBe(text);
    }
  });
});
