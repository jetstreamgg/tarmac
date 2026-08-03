import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChartTooltip } from './ChartTooltip';

// TokenIconStack pulls in TokenIcon → useChainId (wagmi), which needs a
// provider. This suite only exercises ChartTooltip's conditional wiring, so
// stub the stack to a plain span that echoes one child per symbol.
vi.mock('./TokenIconStack', () => ({
  TokenIconStack: (props: { symbols: string[]; 'data-testid'?: string }) => (
    <span data-testid={props['data-testid']}>
      {props.symbols.map(symbol => (
        <span key={symbol} data-token={symbol} />
      ))}
    </span>
  )
}));

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

  it('renders the trailing token icon for a token series', () => {
    render(<ChartTooltip {...base} tokenSymbols={['sUSDS']} />);
    expect(screen.getByTestId('chart-tooltip-token-icon')).toBeTruthy();
  });

  it('renders one badge per token for a pair series', () => {
    render(<ChartTooltip {...base} tokenSymbols={['USDS', 'DAI']} />);
    expect(screen.getByTestId('chart-tooltip-token-icon').children).toHaveLength(2);
  });

  it('renders no token icon when no symbols are given (e.g. a Rate/% metric)', () => {
    render(<ChartTooltip {...base} tokenSymbols={undefined} />);
    expect(screen.queryByTestId('chart-tooltip-token-icon')).toBeNull();
  });

  it('drops the text symbol suffix when a token icon carries the unit', () => {
    render(<ChartTooltip {...base} symbol="USDS" tokenSymbols={['USDS']} />);
    expect(screen.getByText('5,774,407')).toBeTruthy();
    expect(screen.queryByText(/USDS/)).toBeNull();
  });

  it('keeps the text symbol suffix when there is no token icon', () => {
    render(<ChartTooltip {...base} symbol="USDS" />);
    expect(screen.getByText('5,774,407 USDS')).toBeTruthy();
  });
});
