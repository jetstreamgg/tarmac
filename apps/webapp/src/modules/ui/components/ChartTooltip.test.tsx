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
});
