import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { segmentWindow, SeriesMotionLayer } from './ChartSeriesMotion';

const h = vi.hoisted(() => ({
  isActive: false,
  coordinate: undefined as { x: number; y: number } | undefined
}));

// The layer reads the hover state through recharts' chart-context hooks; feed
// it directly so the test doesn't need a live chart interaction. Outside a
// chart, the real ZIndexLayer renders its children in place.
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

const TOTAL = 100;

// happy-dom has no SVG layout; give paths a straight-line geometry where the
// arc length equals x, so window positions are easy to assert.
beforeAll(() => {
  SVGPathElement.prototype.getTotalLength = function () {
    return TOTAL;
  };
  SVGPathElement.prototype.getPointAtLength = function (length: number) {
    return { x: length, y: 0 } as DOMPoint;
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  h.isActive = false;
  h.coordinate = undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const renderLayer = () =>
  render(
    <svg>
      <g className="recharts-area" data-testid="series-layer">
        <path className="recharts-area-area" d="M0,0L100,0L100,50L0,50Z" data-testid="fill" />
        <path className="recharts-area-curve" d="M0,0L100,0" data-testid="curve" />
      </g>
      <SeriesMotionLayer color="red" strokeWidth={1.5} seriesKey="rate-w" data={[1]} />
    </svg>
  );

const finishReveal = () => act(() => vi.advanceTimersByTime(1000));

// The reference lights the span between the hovered point's neighbours; the
// DS's 44px is the floor for series too dense for that span to be visible.
describe('segmentWindow', () => {
  it('keeps the DS floor on dense series, where neighbours sit a few px apart', () => {
    // 170 points over 780px of flat plot: neighbour span ≈ 9px — floor wins.
    expect(segmentWindow(170, 780, 780)).toBe(44);
  });

  it('spans neighbour-to-neighbour on sparse series, in arc length', () => {
    // 9 points over 800px: two 100px intervals; the path is 1600 arc over
    // 800px of x, so the span doubles on the way into arc length.
    expect(segmentWindow(9, 800, 1600)).toBe(400);
  });

  it('never lights more than half the stroke on degenerate series', () => {
    expect(segmentWindow(2, 800, 900)).toBe(450);
  });
});

describe('entrance draw', () => {
  it('draws the stroke tip-first (dash trick) while the fill grows behind a clip', () => {
    renderLayer();
    const curve = screen.getByTestId('curve');
    const fill = screen.getByTestId('fill');

    // Hidden state is a dash the length of the stroke; the transition then
    // carries the offset to 0, which is the tip drawing along the curve.
    expect(curve.style.strokeDasharray).toBe(`${TOTAL} ${TOTAL}`);
    expect(curve.style.strokeDashoffset).toBe('0');
    expect(curve.style.transition).toContain('stroke-dashoffset 900ms');
    expect(fill.style.clipPath).toContain('url(#');
  });

  it('leaves the recharts paths clean once the draw has finished', () => {
    renderLayer();
    finishReveal();

    const curve = screen.getByTestId('curve');
    const fill = screen.getByTestId('fill');
    // A later resize reshapes the path; a stale dasharray would punch gaps in it.
    expect(curve.style.strokeDasharray).toBe('');
    expect(curve.style.strokeDashoffset).toBe('');
    expect(curve.style.transition).toBe('');
    expect(fill.style.clipPath).toBe('');
  });
});

describe('hover segment', () => {
  it('stays dark, with the series at full strength, while nothing is hovered', () => {
    renderLayer();
    finishReveal();

    expect(screen.getByTestId('chart-hover-segment').style.opacity).toBe('0');
    expect(screen.getByTestId('series-layer').style.opacity).toBe('');
  });

  it('dims the series and lights an arc-length window at the hover point', () => {
    h.isActive = true;
    h.coordinate = { x: 30, y: 0 };
    renderLayer();
    finishReveal();

    const segment = screen.getByTestId('chart-hover-segment');
    // The window is a dash on a copy of the live path — 44px of arc length
    // exposed, the rest of the pattern longer than the stroke so only one
    // window ever shows.
    expect(segment.getAttribute('stroke-dasharray')).toBe(`44 ${TOTAL}`);
    // Centred on the hover point's arc length: offset = window/2 - 30.
    expect(segment.style.strokeDashoffset).toBe('-8');
    expect(segment.style.opacity).toBe('1');
    expect(segment.style.transition).toContain('opacity 400ms');

    // The whole base series (stroke + fill) dims together; the active dot and
    // cursor live outside this layer and stay lit.
    expect(screen.getByTestId('series-layer').style.opacity).toBe('0.4');
  });

  it('overhangs the left edge rather than shrinking the window', () => {
    h.isActive = true;
    h.coordinate = { x: 0, y: 0 };
    renderLayer();
    finishReveal();

    // Window start sits at -22 along the stroke; the path simply has nothing
    // to show there, so the visible half is the 22px from the first point on.
    expect(screen.getByTestId('chart-hover-segment').style.strokeDashoffset).toBe('22');
  });

  it('snaps to a new hover after leaving, instead of gliding from the stale spot', () => {
    h.isActive = true;
    h.coordinate = { x: 30, y: 0 };
    const view = renderLayer();
    finishReveal();

    const rerenderLayer = () =>
      view.rerender(
        <svg>
          <g className="recharts-area" data-testid="series-layer">
            <path className="recharts-area-area" d="M0,0L100,0L100,50L0,50Z" data-testid="fill" />
            <path className="recharts-area-curve" d="M0,0L100,0" data-testid="curve" />
          </g>
          <SeriesMotionLayer color="red" strokeWidth={1.5} seriesKey="rate-w" data={[1]} />
        </svg>
      );

    // Leave, then hover somewhere else. The segment was invisible in between,
    // so the window must land at the new point outright — a glide would sweep
    // the fading-in segment across series nobody hovered.
    h.isActive = false;
    h.coordinate = undefined;
    rerenderLayer();
    h.isActive = true;
    h.coordinate = { x: 80, y: 0 };
    rerenderLayer();

    expect(screen.getByTestId('chart-hover-segment').style.strokeDashoffset).toBe('-58');
  });

  it('keeps the hover chrome dark until the entrance draw has finished', () => {
    h.isActive = true;
    h.coordinate = { x: 30, y: 0 };
    renderLayer();

    // No timer advance: the reveal is still running.
    expect(screen.getByTestId('chart-hover-segment').style.opacity).toBe('0');
  });
});
