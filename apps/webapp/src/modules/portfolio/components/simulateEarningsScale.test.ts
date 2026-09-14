import { describe, expect, it } from 'vitest';
import {
  INITIAL_BALANCE,
  MAX_BALANCE,
  MIN_BALANCE,
  STEPS,
  balanceToStep,
  snapBalance,
  snapIncrement,
  stepToBalance,
  stepToProgress
} from './simulateEarningsScale';

describe('simulateEarningsScale', () => {
  it('pins the ends of the travel to the labelled bounds', () => {
    expect(stepToBalance(0)).toBe(MIN_BALANCE);
    expect(stepToBalance(STEPS)).toBe(MAX_BALANCE);
    expect(stepToBalance(-5)).toBe(MIN_BALANCE);
    expect(stepToBalance(STEPS + 5)).toBe(MAX_BALANCE);
    expect(balanceToStep(MIN_BALANCE)).toBe(0);
    expect(balanceToStep(MAX_BALANCE)).toBe(STEPS);
  });

  it('is monotonic across the whole domain', () => {
    let previous = stepToBalance(0);
    for (let step = 1; step <= STEPS; step++) {
      const next = stepToBalance(step);
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
  });

  it('puts the geometric mean of the bounds at the midpoint', () => {
    // sqrt(50k * 10M) ≈ 707,107 → snapped to the $5k grid below $1M.
    expect(stepToBalance(STEPS / 2)).toBe(705_000);
  });

  it('grows by a smaller amount at the start than at the end', () => {
    const first = stepToBalance(10) - stepToBalance(0);
    const last = stepToBalance(STEPS) - stepToBalance(STEPS - 10);
    expect(first).toBeLessThan(last / 50);
  });

  it('lands the initial balance exactly on a step', () => {
    expect(stepToBalance(balanceToStep(INITIAL_BALANCE))).toBe(INITIAL_BALANCE);
  });

  it('round-trips a step through the balance and back', () => {
    for (const step of [0, 1, 17, 60, 125, 200, 249, STEPS]) {
      expect(balanceToStep(stepToBalance(step))).toBe(step);
    }
  });

  it('snaps to an increment that scales with magnitude', () => {
    expect(snapIncrement(60_000)).toBe(1_000);
    expect(snapIncrement(100_000)).toBe(5_000);
    expect(snapIncrement(999_999)).toBe(5_000);
    expect(snapIncrement(1_000_000)).toBe(50_000);
    expect(snapBalance(60_450)).toBe(60_000);
    expect(snapBalance(60_500)).toBe(61_000);
    expect(snapBalance(347_400)).toBe(345_000);
    expect(snapBalance(2_426_000)).toBe(2_450_000);
    expect(snapBalance(10)).toBe(MIN_BALANCE);
    expect(snapBalance(1e9)).toBe(MAX_BALANCE);
  });

  it('maps the step to a 0–100 progress share', () => {
    expect(stepToProgress(0)).toBe(0);
    expect(stepToProgress(STEPS / 2)).toBe(50);
    expect(stepToProgress(STEPS)).toBe(100);
  });
});
