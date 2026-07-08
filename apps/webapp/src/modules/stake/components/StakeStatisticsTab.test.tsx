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
  it('mounts the chart, details strip and utilization block in the main column and the engine card in the rail', () => {
    render(<StakeStatisticsTab />);

    const chart = screen.getByTestId('stub-rate-chart');
    const strip = screen.getByTestId('stub-details-strip');
    const utilization = screen.getByTestId('stub-borrow-utilization');
    const engineCard = screen.getByTestId('stub-engine-card');

    const mainColumn = chart.parentElement;
    expect(mainColumn).toBe(strip.parentElement);
    expect(mainColumn).toBe(utilization.parentElement);
    expect(engineCard.parentElement).not.toBe(mainColumn);
  });
});
