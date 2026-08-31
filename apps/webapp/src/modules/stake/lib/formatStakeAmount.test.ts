import { describe, expect, it } from 'vitest';
import { formatStakeAmount } from './formatStakeAmount';

describe('formatStakeAmount', () => {
  it('renders zero as an explicit 0.00 cell', () => {
    expect(formatStakeAmount(0n)).toBe('0.00');
  });

  it('delegates non-zero amounts to the app-wide formatter', () => {
    expect(formatStakeAmount(30000n * 10n ** 18n)).toBe('30,000');
  });
});
