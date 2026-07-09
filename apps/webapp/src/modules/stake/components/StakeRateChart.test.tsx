import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Fixed historic series. Newest by datetime is 2026-06-01 (borrowRate 0.075 -> 7.5%,
// tvl 1,000,000 -> $1M). The hero reads the newest raw datapoint regardless of the
// timeframe-filtered chart series, so the assertions are wall-clock independent.
const HISTORIC = [
  { date: '2026-06-01', datetime: '2026-06-01T00:00:00Z', borrowRate: 0.075, tvl: 1000000 },
  { date: '2026-01-01', datetime: '2026-01-01T00:00:00Z', borrowRate: 0.03, tvl: 500000 }
];

// On-chain stability fee (0.082 WAD → 8.2%), deliberately different from the
// series' newest point (7.5%) so the hero's source is provable.
const STABILITY_FEE = 82n * 10n ** 15n;

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeHistoricData: () => ({ data: HISTORIC, isLoading: false, error: null }),
    useCollateralData: () => ({ data: { stabilityFee: STABILITY_FEE }, isLoading: false, error: null })
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
    expect(within(toggle).getByText('Rate')).toBeTruthy();
    expect(within(toggle).getByText('TVL')).toBeTruthy();
  });

  it('shows the on-chain stability fee as the rate hero, not the charted series', () => {
    renderChart();

    expect(screen.getByText('Current Rate')).toBeTruthy();
    // The hero is the protocol's live rate (8.2%), while the analytics series'
    // newest point (7.5%) only draws the chart line.
    expect(screen.getByText('8.2%')).toBeTruthy();
    expect(screen.queryByText('7.5%')).toBeNull();
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
