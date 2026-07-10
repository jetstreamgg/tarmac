import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Historic series feeding the TVL and Users rows (rates here are ignored since
// the rate rows read the farms endpoint instead).
const HISTORIC = [
  { datetime: '2026-07-01T00:00:00Z', borrowRate: 0.1, tvl: 1000, numberOfUrns: 50 },
  { datetime: '2026-04-01T00:00:00Z', borrowRate: 0.2, tvl: 900, numberOfUrns: 40 }
];

const ts = (date: string) => new Date(date).getTime() / 1000;

// Rewards-rate series: latest point is 2026-07-01 (rate 0.10 -> Current Rate).
// The 2026-04-01 point is within the trailing 183 days; the 2025-06-01 point is
// outside it and must be excluded from the mean: (0.10 + 0.20) / 2 = 0.15.
const FARM = [
  { blockTimestamp: ts('2026-07-01'), rate: '0.1' },
  { blockTimestamp: ts('2026-04-01'), rate: '0.2' },
  { blockTimestamp: ts('2025-06-01'), rate: '0.99' }
];

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeHistoricData: () => ({ data: HISTORIC, isLoading: false, error: null }),
    useStakeRewardContracts: () => ({ data: [{ contractAddress: '0xfarm' }], isLoading: false }),
    useMultipleRewardsChartInfo: () => ({ data: [FARM], isLoading: false, error: null })
  };
});

import { StakeDetailsStrip, calculateTrailing6MonthRate } from './StakeDetailsStrip';

const renderStrip = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeDetailsStrip />
    </I18nProvider>
  );

describe('calculateTrailing6MonthRate', () => {
  it('averages only the rates within the trailing 6 months of the latest point', () => {
    expect(calculateTrailing6MonthRate(FARM)).toBeCloseTo(0.15, 10);
  });

  it('returns null for empty or missing data', () => {
    expect(calculateTrailing6MonthRate([])).toBeNull();
    expect(calculateTrailing6MonthRate(undefined)).toBeNull();
  });

  it('returns null when a rate in the window does not parse', () => {
    expect(
      calculateTrailing6MonthRate([{ blockTimestamp: ts('2026-07-01'), rate: 'not-a-number' }])
    ).toBeNull();
  });
});

describe('StakeDetailsStrip', () => {
  afterEach(cleanup);

  it('renders all six detail labels', () => {
    renderStrip();

    expect(screen.getByTestId('stake-details-strip')).toBeTruthy();
    expect(screen.getByText('Current Rate')).toBeTruthy();
    expect(screen.getByText('6M Rate')).toBeTruthy();
    expect(screen.getByText('Risk scale')).toBeTruthy();
    expect(screen.getByText('TVL')).toBeTruthy();
    expect(screen.getByText('Liquidity')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
  });

  it('renders the latest rewards rate as the Current Rate', () => {
    renderStrip();

    // Latest farm datapoint: 0.10 -> 10.00%.
    expect(screen.getByText('10.00%')).toBeTruthy();
  });

  it('renders the trailing-6-month mean of the rewards-rate series', () => {
    renderStrip();

    // (0.10 + 0.20) / 2 = 0.15 -> 15.00%
    expect(screen.getByText('15.00%')).toBeTruthy();
  });

  it('renders the static Unlimited liquidity value', () => {
    renderStrip();

    expect(screen.getByText('Unlimited')).toBeTruthy();
  });
});
