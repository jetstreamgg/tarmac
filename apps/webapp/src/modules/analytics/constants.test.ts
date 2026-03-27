import { describe, expect, it } from 'vitest';
import { isWithdrawalFlow } from './constants';

describe('isWithdrawalFlow', () => {
  it('returns true for direct widget withdraw flows', () => {
    expect(isWithdrawalFlow('savings', null, 'withdraw', null, null)).toBe(true);
  });

  it('returns true for stUSDS withdraws opened via expert widget', () => {
    expect(isWithdrawalFlow('expert', 'stusds', 'withdraw', null, null)).toBe(true);
  });

  it('returns false for non-withdraw stUSDS expert flows', () => {
    expect(isWithdrawalFlow('expert', 'stusds', 'deposit', null, null)).toBe(false);
  });

  it('preserves tab-based withdrawal detection for stake and seal', () => {
    expect(isWithdrawalFlow('stake', null, null, 'free', null)).toBe(true);
    expect(isWithdrawalFlow('seal', null, null, null, 'free')).toBe(true);
  });
});
