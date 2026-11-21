import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TimeFrame } from '@/modules/ui/components/Chart';
import { useSettledTimeFrame } from './useSettledTimeFrame';

describe('useSettledTimeFrame', () => {
  it('holds the previous timeframe while the data is a placeholder, then follows', () => {
    const { result, rerender } = renderHook(
      ({ timeFrame, placeholder }: { timeFrame: TimeFrame; placeholder: boolean }) =>
        useSettledTimeFrame(timeFrame, placeholder),
      { initialProps: { timeFrame: 'w' as TimeFrame, placeholder: false } }
    );
    expect(result.current).toBe('w');

    rerender({ timeFrame: 'y', placeholder: true });
    expect(result.current).toBe('w');

    rerender({ timeFrame: 'y', placeholder: false });
    expect(result.current).toBe('y');

    // A second switch holds the range last settled on, not the first one.
    rerender({ timeFrame: 'all', placeholder: true });
    expect(result.current).toBe('y');
  });
});
