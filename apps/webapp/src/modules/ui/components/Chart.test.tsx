import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Chart, HoverDimMask, resolveTooltipLabel } from './Chart';

const h = vi.hoisted(() => ({
  isActive: false,
  coordinate: undefined as { x: number; y: number } | undefined,
  isMobile: false
}));

// happy-dom's 1024px default always lands desktop; isMobile drives the M6.3
// detail-header branch.
vi.mock('@/hooks/ui/useBreakpoint', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/ui/useBreakpoint')>();
  return {
    ...actual,
    useBreakpointIndex: () => ({ bpi: h.isMobile ? actual.BP.sm : actual.BP.desktop })
  };
});

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

// APP-443 item 19.4: hovering dims the whole series and relights only the span
// between the neighbouring data points, never narrower than the DS mock's 44px.
describe('HoverDimMask', () => {
  const renderMask = (pointCount: number) =>
    render(
      <svg>
        <HoverDimMask id="dim" pointCount={pointCount} />
      </svg>
    );

  it('lights the span from the previous data point to the next one', () => {
    h.isActive = true;
    h.coordinate = { x: 300, y: 100 };
    // 9 points across 800px → a 100px step either side of the cursor.
    renderMask(9);

    expect(Number(screen.getByTestId('chart-dim-mask-base').getAttribute('opacity'))).toBeLessThan(1);

    const lit = screen.getByTestId('chart-dim-mask-lit');
    expect(lit.getAttribute('x')).toBe('200');
    expect(lit.getAttribute('width')).toBe('200');
    expect(lit.getAttribute('fill')).toBe('white');
  });

  it('widens a dense series to the minimum window instead of lighting a sliver', () => {
    h.isActive = true;
    h.coordinate = { x: 300, y: 100 };
    // 401 points across 800px → a 2px step, well under the 22px floor.
    renderMask(401);

    const lit = screen.getByTestId('chart-dim-mask-lit');
    expect(lit.getAttribute('x')).toBe('278');
    expect(lit.getAttribute('width')).toBe('44');
  });

  it('clamps the window to the plot at the edges', () => {
    h.isActive = true;
    h.coordinate = { x: 0, y: 100 };
    renderMask(9);

    const lit = screen.getByTestId('chart-dim-mask-lit');
    expect(lit.getAttribute('x')).toBe('0');
    expect(lit.getAttribute('width')).toBe('100');
  });

  it('shows the whole plot at full strength when nothing is hovered', () => {
    h.isActive = false;
    h.coordinate = undefined;
    renderMask(9);

    const base = screen.getByTestId('chart-dim-mask-base');
    expect(base.getAttribute('width')).toBe('800');
    expect(Number(base.getAttribute('opacity'))).toBe(1);
    expect(screen.queryByTestId('chart-dim-mask-lit')).toBeNull();
  });
});

// M6.3 (Figma 486:20761): below BP.md the detail header re-stacks — the
// Rate|TVL toggle becomes a full-width bar ABOVE the label/value block and the
// timeframe toggle moves to a full-width bar at the card's bottom, under the
// plot. Desktop keeps label/value left with both toggles clustered right.
describe('Chart — detail variant header order', () => {
  afterEach(() => {
    cleanup();
    h.isMobile = false;
  });

  const renderDetail = () =>
    render(
      <Chart
        variant="detail"
        dataTestId="detail-chart"
        data={[
          { value: 3.7, date: new Date('2026-01-01') },
          { value: 3.75, date: new Date('2026-01-02') }
        ]}
        isPercentage
        displayValue={3.75}
        label="Current Rate"
        metrics={METRICS}
        activeMetric="rate"
        onMetricChange={() => {}}
      />
    );

  const isBefore = (a: Element, b: Element) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('desktop: value block precedes the metric and timeframe toggles', () => {
    renderDetail();

    const value = screen.getByTestId('chart-detail-value');
    const metric = screen.getByTestId('chart-metric-toggle');
    const timeframe = screen.getByTestId('chart-timeframe-toggle');
    expect(isBefore(value, metric)).toBe(true);
    expect(isBefore(metric, timeframe)).toBe(true);
  });

  it('mobile: metric toggle leads, timeframe toggle trails the plot', () => {
    h.isMobile = true;
    renderDetail();

    const value = screen.getByTestId('chart-detail-value');
    const metric = screen.getByTestId('chart-metric-toggle');
    const timeframe = screen.getByTestId('chart-timeframe-toggle');
    const plot = screen.getByTestId('detail-chart-plot');
    expect(isBefore(metric, value)).toBe(true);
    expect(isBefore(value, plot)).toBe(true);
    expect(isBefore(plot, timeframe)).toBe(true);
  });
});
