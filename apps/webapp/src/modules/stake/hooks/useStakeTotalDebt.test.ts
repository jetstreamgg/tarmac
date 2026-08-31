import { describe, expect, it } from 'vitest';
import { sumUrnDebts } from './useStakeTotalDebt';

const RAY = 10n ** 27n;

describe('sumUrnDebts', () => {
  it('sums art × rate across urns in wad', () => {
    // rate 1.13 RAY, arts of 100 and 200 wad -> 113 + 226 = 339 wad
    const rate = (113n * RAY) / 100n;
    expect(sumUrnDebts(rate, [100n * 10n ** 18n, 200n * 10n ** 18n])).toBe(339n * 10n ** 18n);
  });

  it('is zero for no urns or zero art', () => {
    expect(sumUrnDebts(RAY, [])).toBe(0n);
    expect(sumUrnDebts(RAY, [0n, 0n])).toBe(0n);
  });
});
