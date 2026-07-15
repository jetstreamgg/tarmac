import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HoverDimMask, resolveTooltipLabel } from './Chart';

const h = vi.hoisted(() => ({
  isActive: false,
  coordinate: undefined as { x: number; y: number } | undefined
}));

// The mask reads the hover state through recharts' chart-context hooks; feed
// it directly so the test doesn't need a live chart interaction.
vi.mock('recharts', async importOriginal => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    useIsTooltipActive: () => h.isActive,
    useActiveTooltipCoordinate: () => h.coordinate,
    useChartWidth: () => 800,
    useChartHeight: () => 240
  };
});

afterEach(cleanup);

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

describe('HoverDimMask', () => {
  it('dims the plot past the hover cursor, full strength before it', () => {
    h.isActive = true;
    h.coordinate = { x: 300, y: 100 };
    render(
      <svg>
        <HoverDimMask id="dim" />
      </svg>
    );

    const lit = screen.getByTestId('chart-dim-mask-lit');
    expect(lit.getAttribute('width')).toBe('300');
    expect(lit.getAttribute('fill')).toBe('white');

    const dimmed = screen.getByTestId('chart-dim-mask-dimmed');
    expect(dimmed.getAttribute('x')).toBe('300');
    expect(dimmed.getAttribute('width')).toBe('500');
    expect(Number(dimmed.getAttribute('opacity'))).toBeLessThan(1);
  });

  it('shows the whole plot at full strength when nothing is hovered', () => {
    h.isActive = false;
    h.coordinate = undefined;
    render(
      <svg>
        <HoverDimMask id="dim" />
      </svg>
    );

    expect(screen.getByTestId('chart-dim-mask-lit').getAttribute('width')).toBe('800');
    expect(screen.queryByTestId('chart-dim-mask-dimmed')).toBeNull();
  });
});
