import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { calculateAvailableBorrow } from './maxBorrow';

const usds = (value: string) => parseUnits(value, 18);

describe('calculateAvailableBorrow', () => {
  it('floors a debt-ceiling-bound cap to whole USDS', () => {
    const { fromDebtCeiling, balance } = calculateAvailableBorrow(
      { debtCeiling: usds('40000.6'), totalDaiDebt: 0n },
      usds('300000')
    );
    expect(balance).toBe(usds('40000'));
    // The ceiling check itself stays exact.
    expect(fromDebtCeiling).toBe(usds('40000.6'));
  });

  it('keeps a collateral-bound cap as is', () => {
    const { balance } = calculateAvailableBorrow(
      { debtCeiling: usds('1000000'), totalDaiDebt: 0n },
      usds('1227')
    );
    expect(balance).toBe(usds('1227'));
  });
});
