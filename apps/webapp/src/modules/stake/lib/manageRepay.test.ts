import { describe, expect, it } from 'vitest';
import { parseUnits } from 'viem';
import { calculateMaxRepayable } from './manageRepay';

const usds = (value: string) => parseUnits(value, 18);

// Fork-container ilk config: dust = 30,000 USDS.
const DUST = usds('30000');

describe('calculateMaxRepayable — legacy Repay.tsx math, verbatim', () => {
  it('returns 0 without debt or balance', () => {
    expect(calculateMaxRepayable({ debtValue: 0n, dust: DUST, balance: usds('100') })).toBe(0n);
    expect(calculateMaxRepayable({ debtValue: usds('100'), dust: DUST, balance: 0n })).toBe(0n);
  });

  it('caps at the full debt when the balance covers it', () => {
    expect(calculateMaxRepayable({ debtValue: usds('30000'), dust: DUST, balance: usds('50000') })).toEqual(
      usds('30000')
    );
  });

  it('uses the full balance when the remaining debt stays above dust', () => {
    // debt 70k, balance 30k → remaining 40k ≥ dust 30k → repay the balance.
    expect(calculateMaxRepayable({ debtValue: usds('70000'), dust: DUST, balance: usds('30000') })).toEqual(
      usds('30000')
    );
  });

  it('caps at debt−dust when a full-balance repay would strand a sub-dust remainder', () => {
    // debt 40k, balance 30k → remaining 10k < dust → cap at 40k−30k = 10k.
    expect(calculateMaxRepayable({ debtValue: usds('40000'), dust: DUST, balance: usds('30000') })).toEqual(
      usds('10000')
    );
  });

  it('stays inside the balance/dust-gap rules when only part of the debt is reachable', () => {
    // debt 40k, balance 5k → remaining 35k ≥ dust → repay balance 5k.
    expect(calculateMaxRepayable({ debtValue: usds('40000'), dust: DUST, balance: usds('5000') })).toEqual(
      usds('5000')
    );
    // debt 30,000.10, balance 29,999 → remaining ~1 < dust; maxWithoutDust ≈ 0.10
    // and the balance covers it → 0.10.
    expect(calculateMaxRepayable({ debtValue: usds('30000.1'), dust: DUST, balance: usds('29999') })).toEqual(
      usds('0.1')
    );
  });

  it('returns 0 when even the dust-capped repay is out of reach', () => {
    // debt exactly at dust, tiny balance → remaining < dust and debt−dust = 0:
    // nothing short of a full wipe is repayable.
    expect(calculateMaxRepayable({ debtValue: usds('30000'), dust: DUST, balance: usds('1') })).toBe(0n);
    // debt below dust (already sub-dust urn) → debt−dust is negative → 0.
    expect(calculateMaxRepayable({ debtValue: usds('29000'), dust: DUST, balance: usds('1000') })).toBe(0n);
  });
});
