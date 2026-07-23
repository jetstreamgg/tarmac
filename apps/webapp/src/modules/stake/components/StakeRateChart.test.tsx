import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Fixed historic series feeding the TVL metric. Newest by datetime is
// 2026-06-01 (tvl 1,000,000 -> $1M hero).
const HISTORIC = [
  { date: '2026-06-01', datetime: '2026-06-01T00:00:00Z', borrowRate: 0.075, tvl: 1000000 },
  { date: '2026-01-01', datetime: '2026-01-01T00:00:00Z', borrowRate: 0.03, tvl: 500000 }
];

const ts = (date: string) => new Date(date).getTime() / 1000;

// Two stake farms. Farm A's latest rate (5.69%) beats farm B's (3%), so the
// Rate hero must read farm A — the same winner the promo card crowns.
const FARM_A = [
  { blockTimestamp: ts('2026-01-01'), rate: '0.02' },
  { blockTimestamp: ts('2026-06-01'), rate: '0.0569' }
];
const FARM_B = [
  { blockTimestamp: ts('2026-01-01'), rate: '0.09' },
  { blockTimestamp: ts('2026-06-01'), rate: '0.03' }
];

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeHistoricData: () => ({ data: HISTORIC, isLoading: false, error: null }),
    useStakeRewardContracts: () => ({
      data: [{ contractAddress: '0xfarmA' }, { contractAddress: '0xfarmB' }],
      isLoading: false
    }),
    useMultipleRewardsChartInfo: () => ({ data: [FARM_A, FARM_B], isLoading: false, error: null })
  };
});

import { StakeRateChart } from './StakeRateChart';

const renderChart = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeRateChart />
    </I18nProvider>
  );

describe('StakeRateChart', () => {
  afterEach(cleanup);

  it('renders the chart container with the series toggle', () => {
    renderChart();

    expect(screen.getByTestId('stake-rate-chart')).toBeTruthy();
    const toggle = screen.getByTestId('chart-metric-toggle');
    expect(within(toggle).getByText('Staking rate')).toBeTruthy();
    expect(within(toggle).getByText('Borrow rate')).toBeTruthy();
    expect(within(toggle).getByText('TVL')).toBeTruthy();
  });

  it('shows the winning farm rewards rate as the rate hero, not the borrow rate', () => {
    renderChart();

    expect(screen.getByText('Staking Reward Rate')).toBeTruthy();
    // The hero is the highest-rate farm's latest datapoint (5.69%) — not the
    // losing farm's (3%) and not the historic borrowRate (7.5%).
    expect(screen.getByText('5.69%')).toBeTruthy();
    expect(screen.queryByText('3%')).toBeNull();
    expect(screen.queryByText('7.5%')).toBeNull();
  });

  it('switches the hero to the latest borrow rate when the Borrow rate toggle is clicked', () => {
    renderChart();

    fireEvent.click(within(screen.getByTestId('chart-metric-toggle')).getByText('Borrow rate'));

    // Newest historic borrowRate (0.075) plotted/shown as a percentage.
    expect(screen.getByText('Borrow Rate')).toBeTruthy();
    expect(screen.getByText('7.5%')).toBeTruthy();
  });

  it('switches the hero to the TVL series when the toggle is clicked', () => {
    renderChart();

    fireEvent.click(within(screen.getByTestId('chart-metric-toggle')).getByText('TVL'));

    // Newest tvl datapoint (1,000,000) with the $ prefix, compacted to $1M.
    expect(screen.getByText('$1M')).toBeTruthy();
    // The Rate hero label is gone once TVL is selected.
    expect(screen.queryByText('Current Rate')).toBeNull();
  });
});
