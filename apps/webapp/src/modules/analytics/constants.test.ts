import { describe, expect, it } from 'vitest';
import { signedAmount } from './constants';

describe('signedAmount', () => {
  it('negates withdraw flows', () => {
    expect(signedAmount(100, 'withdraw')).toBe(-100);
  });

  it('negates revert flows', () => {
    expect(signedAmount(50, 'revert')).toBe(-50);
  });

  it('keeps supply flows positive', () => {
    expect(signedAmount(100, 'supply')).toBe(100);
  });

  it('normalizes an already-negative amount to the flow convention', () => {
    expect(signedAmount(-100, 'supply')).toBe(100);
    expect(signedAmount(-100, 'withdraw')).toBe(-100);
  });

  it('returns undefined when the amount is missing', () => {
    expect(signedAmount(null, 'withdraw')).toBeUndefined();
    expect(signedAmount(undefined, 'supply')).toBeUndefined();
  });

  it('treats an undefined flow as non-withdrawal', () => {
    expect(signedAmount(100, undefined)).toBe(100);
  });
});
