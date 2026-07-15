import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChartTooltip } from './ChartTooltip';

afterEach(cleanup);

const base = {
  active: true,
  label: new Date('2026-03-12T00:00:00Z'),
  labelFormatter: () => 'Mar 12, 2026',
  tooltipLabel: 'Sky TVL',
  payload: [{ color: '#02C2A1', value: 5774407, payload: {} }]
};

describe('ChartTooltip', () => {
  it('renders the date header and series label', () => {
    render(<ChartTooltip {...base} />);
    expect(screen.getByText('Mar 12, 2026')).toBeTruthy();
    expect(screen.getByText('Sky TVL')).toBeTruthy();
  });

  it('renders nothing when inactive', () => {
    render(<ChartTooltip {...base} active={false} />);
    expect(screen.queryByText('Sky TVL')).toBeNull();
  });

  it('accepts a ReactNode series label (Trans elements from metric pills)', () => {
    render(<ChartTooltip {...base} tooltipLabel={<span>Rate</span>} />);
    expect(screen.getByText('Rate')).toBeTruthy();
  });

  it('omits the series-label cell entirely when no label resolves (no empty gap)', () => {
    render(<ChartTooltip {...base} tooltipLabel={undefined} />);
    expect(screen.queryByTestId('chart-tooltip-series-label')).toBeNull();
    expect(screen.getByText('5,774,407')).toBeTruthy();
  });
});
