import { describe, expect, it } from 'vitest';
import { formatUsdCompact } from './formatUsdCompact';

describe('formatUsdCompact — compact figures (APP-395, 1036:201322)', () => {
  it('compacts thousands and above with magnitude suffixes', () => {
    expect(formatUsdCompact(4_707_718_340)).toBe('$4.71B');
    expect(formatUsdCompact(552_086_632)).toBe('$552.09M');
    expect(formatUsdCompact(120_700)).toBe('$120.7K');
  });

  it('keeps small figures as plain two-decimal money', () => {
    expect(formatUsdCompact(0)).toBe('$0.00');
    expect(formatUsdCompact(999.99)).toBe('$999.99');
  });

  it('carries the sign in front of the symbol', () => {
    expect(formatUsdCompact(-4_707_718_340)).toBe('-$4.71B');
  });
});
