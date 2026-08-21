import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StakeStatisticsTab } from './StakeStatisticsTab';

// Composition-only test: each child owns its data states and has its own
// suite — this pins that the tab mounts all four in their grid slots.
vi.mock('./StakeRateChart', () => ({
  StakeRateChart: () => <div data-testid="stub-rate-chart" />
}));
vi.mock('./StakeDetailsStrip', () => ({
  StakeDetailsStrip: () => <div data-testid="stub-details-strip" />
}));
vi.mock('./BorrowUtilizationBlock', () => ({
  BorrowUtilizationBlock: () => <div data-testid="stub-borrow-utilization" />
}));
vi.mock('./StakeEngineCard', () => ({
  StakeEngineCard: () => <div data-testid="stub-engine-card" />
}));

describe('StakeStatisticsTab', () => {
  it('rows the chart with the engine card, groups Details with Borrow Utilization separately, and preserves the mobile stack order', () => {
    render(<StakeStatisticsTab />);

    const chart = screen.getByTestId('stub-rate-chart');
    const strip = screen.getByTestId('stub-details-strip');
    const utilization = screen.getByTestId('stub-borrow-utilization');
    const engineCard = screen.getByTestId('stub-engine-card');

    const chartCell = chart.parentElement;
    const engineCell = engineCard.parentElement;
    const detailsGroup = strip.parentElement;

    // Details and Borrow Utilization share one container, distinct from both
    // the chart's cell and the engine card's cell — B7 pulled them out of the
    // chart's row into a row of their own.
    expect(detailsGroup).toBe(utilization.parentElement);
    expect(detailsGroup).not.toBe(chartCell);
    expect(detailsGroup).not.toBe(engineCell);

    // All three cells sit in the same top-level grid — this alone doesn't
    // prove row membership (CSS Grid has no per-row DOM wrapper), which is
    // why the col-span assertions below carry the real signal.
    const grid = chartCell?.parentElement;
    expect(grid).toBe(engineCell?.parentElement);
    expect(grid).toBe(detailsGroup?.parentElement);

    // The chart/engine-card row membership is the actual mechanism B7 relies
    // on: lg:col-span-2 + lg:col-span-1 fill exactly one 3-column grid row,
    // so the grid's default `align-items: stretch` makes the engine card
    // match the chart's height, not the whole column. This is only testable
    // via the grid-placement classes (there's no separate DOM node per row),
    // so a class assertion is the structural check here — it should fail if
    // the grid is ever flattened back to a single stacked column.
    expect(chartCell?.className).toContain('lg:col-span-2');
    expect(engineCell?.className).toContain('lg:col-span-1');
    // Details+Borrow repeat lg:col-span-2, confining them to the chart's
    // column width in their own row rather than the engine card's row.
    expect(detailsGroup?.className).toContain('lg:col-span-2');

    // Mobile order (comp 1222:17089): promo card → chart → Details → Borrow
    // Utilization, independent of the desktop grid placement above.
    expect(engineCell?.className).toContain('order-1');
    expect(chartCell?.className).toContain('order-2');
    expect(detailsGroup?.className).toContain('order-3');
  });
});
