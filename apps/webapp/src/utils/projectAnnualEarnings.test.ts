import { describe, expect, it } from 'vitest';
import { projectAnnualEarnings } from './projectAnnualEarnings';

describe('projectAnnualEarnings', () => {
  it('multiplies principal by the annual rate', () => {
    expect(projectAnnualEarnings(1000, 0.045)).toBeCloseTo(45);
  });

  it('treats a missing rate as 0 rather than NaN', () => {
    expect(projectAnnualEarnings(1000, undefined)).toBe(0);
  });

  it('returns 0 for a zero principal', () => {
    expect(projectAnnualEarnings(0, 0.05)).toBe(0);
  });
});
