import { describe, expect, it } from 'vitest';

import { resolveTooltipLabel } from './Chart';

const METRICS = [
  { value: 'rate', label: 'Rate' },
  { value: 'tvl', label: 'TVL' }
];

describe('resolveTooltipLabel', () => {
  it('prefers an explicit chart-level tooltip label', () => {
    expect(resolveTooltipLabel('Daily average', METRICS, 'rate')).toBe('Daily average');
  });

  it('falls back to the active metric pill label (detail variant)', () => {
    expect(resolveTooltipLabel(undefined, METRICS, 'tvl')).toBe('TVL');
  });

  it('resolves to nothing when there is neither label nor metric toggle', () => {
    expect(resolveTooltipLabel(undefined, undefined, undefined)).toBeUndefined();
  });
});
