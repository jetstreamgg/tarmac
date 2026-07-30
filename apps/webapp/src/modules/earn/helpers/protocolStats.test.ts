import { describe, expect, it } from 'vitest';
import {
  PROTOCOL_START,
  formatCirculation,
  formatCirculationCoarse,
  protocolStartYear,
  yearsOperating
} from './protocolStats';

describe('yearsOperating', () => {
  it('counts whole years since the protocol start', () => {
    expect(yearsOperating(new Date(Date.UTC(2026, 6, 30)))).toBe(9);
  });

  it('only ticks over on the anniversary', () => {
    expect(yearsOperating(new Date(Date.UTC(2025, 11, 31)))).toBe(8);
    expect(yearsOperating(new Date(Date.UTC(2026, 0, 1)))).toBe(9);
  });

  it('never reports a negative count before the start date', () => {
    expect(yearsOperating(new Date(Date.UTC(2016, 0, 1)))).toBe(0);
  });
});

describe('protocolStartYear', () => {
  it('is the start date year as a string, so i18n cannot group it as "2,017"', () => {
    expect(protocolStartYear).toBe('2017');
    expect(protocolStartYear).toBe(String(PROTOCOL_START.getUTCFullYear()));
  });
});

describe('formatCirculation', () => {
  it('renders the hero badge form with an uppercase magnitude suffix', () => {
    expect(formatCirculation(11_020_000_000)).toBe('$11.02B');
  });

  it('keeps two decimals of precision', () => {
    expect(formatCirculation(11_784_000_000)).toBe('$11.78B');
  });
});

describe('formatCirculationCoarse', () => {
  it('drops to whole units for the subtitle', () => {
    expect(formatCirculationCoarse(11_020_000_000)).toBe('$11B');
  });

  it('floors rather than rounds, so it never overstates the badge beside it', () => {
    // Rounding would print "$10B" under a badge reading "$9.69B".
    expect(formatCirculationCoarse(9_688_518_808)).toBe('$9B');
    expect(formatCirculationCoarse(11_784_000_000)).toBe('$11B');
  });
});
