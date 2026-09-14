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
vi.mock('./StakeRailCard', () => ({
  StakeRailCard: () => <div data-testid="stub-rail-card" />
}));

describe('StakeStatisticsTab', () => {
  it('stacks chart, Details and Borrow Utilization in the left column, with the rail card in its own rail', () => {
    render(<StakeStatisticsTab rail={{ positions: [], isLoading: false }} />);

    const chart = screen.getByTestId('stub-rate-chart');
    const strip = screen.getByTestId('stub-details-strip');
    const utilization = screen.getByTestId('stub-borrow-utilization');
    const railCard = screen.getByTestId('stub-rail-card');

    // Chart, Details and Borrow Utilization all live in the same left-column
    // container, in that DOM order.
    const leftColumn = chart.parentElement;
    expect(leftColumn).toBe(strip.parentElement);
    expect(leftColumn).toBe(utilization.parentElement);
    const leftColumnChildren = Array.from(leftColumn?.children ?? []);
    expect(leftColumnChildren.indexOf(chart)).toBeLessThan(leftColumnChildren.indexOf(strip));
    expect(leftColumnChildren.indexOf(strip)).toBeLessThan(leftColumnChildren.indexOf(utilization));

    // The rail card sits in a separate cell from the left column, as a
    // sibling in the same top-level grid — not sharing a row/column with the
    // chart, so it never inherits the left column's (much taller) height.
    const railCell = railCard.parentElement;
    expect(railCell).not.toBe(leftColumn);
    const grid = leftColumn?.parentElement;
    expect(grid).toBe(railCell?.parentElement);
    expect(grid?.className).toContain('items-start');

    // Mobile order (comp 1222:17089): rail card → chart → Details → Borrow
    // Utilization, independent of the desktop grid placement above.
    expect(railCell?.className).toContain('order-1');
    expect(leftColumn?.className).toContain('order-2');
  });
});
