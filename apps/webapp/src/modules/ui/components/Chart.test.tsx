import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ActiveDot, Chart, HoverCursor, resolveTooltipLabel } from './Chart';

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

// The series motion layer reads the hover state through recharts' chart-context
// hooks; feed it directly so the test doesn't need a live chart interaction.
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

// Figma: Sky App: UI 1598:76169. The comp's quart ease-in-out cannot drive
// these: while the pointer is in flight the target moves every frame, so each
// frame restarts the transition and only the curve's flattest opening is ever
// used (~1.3% of the remaining distance per frame). `useFollow` integrates
// toward the target instead — see chartMotion.ts — which is why the assertions
// below check for a written transform and the *absence* of a CSS transition.
describe('hover tracking', () => {
  /** The follower places the first frame outright, with nothing to ease. */
  const expectFollowed = (el: HTMLElement | SVGElement, transform: string) => {
    expect(el.style.transform).toBe(transform);
    expect(el.style.transition).toBe('');
  };

  it('carries the dot on a transform so it can glide in both axes', () => {
    render(
      <svg>
        <ActiveDot cx={120} cy={40} color="red" />
      </svg>
    );

    const dot = screen.getByTestId('chart-active-dot');
    // Position lives on the group; the circles stay at the origin, which is
    // what lets one transform move the whole dot.
    expect(dot.querySelector('circle')?.getAttribute('cx')).toBeNull();
    expectFollowed(dot, 'translate(120px, 40px)');
  });

  it('draws the cursor as a translated rule rather than moving x1/x2', () => {
    render(
      <svg>
        <HoverCursor
          points={[
            { x: 200, y: 0 },
            { x: 200, y: 240 }
          ]}
        />
      </svg>
    );

    const cursor = screen.getByTestId('chart-hover-cursor');
    expect(cursor.getAttribute('x1')).toBe('0');
    expect(cursor.getAttribute('x2')).toBe('0');
    expect(cursor.getAttribute('stroke-dasharray')).toBe('3 3');
    expectFollowed(cursor, 'translate(200px, 0px)');
  });

  it('renders nothing until there is a hover point to track', () => {
    render(
      <svg>
        <ActiveDot color="red" />
        <HoverCursor />
      </svg>
    );
    expect(screen.queryByTestId('chart-active-dot')).toBeNull();
    expect(screen.queryByTestId('chart-hover-cursor')).toBeNull();
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

describe('Chart — trend badge', () => {
  afterEach(cleanup);

  const renderTrend = (first: number, last: number) =>
    render(
      <Chart
        variant="detail"
        dataTestId="trend-chart"
        data={[
          { value: first, date: new Date('2026-01-01') },
          { value: last, date: new Date('2026-01-02') }
        ]}
        label="Total value locked"
        metrics={METRICS}
        activeMetric="tvl"
        onMetricChange={() => {}}
        showTrend
      />
    );

  it('signs a rising period with a plus', () => {
    renderTrend(100, 105);
    expect(screen.getByTestId('chart-trend-badge').textContent).toMatch(/^\+\d/);
  });

  it('signs a falling period with a minus rather than relying on colour alone', () => {
    renderTrend(100, 95);
    expect(screen.getByTestId('chart-trend-badge').textContent).toMatch(/^-\d/);
  });
});
