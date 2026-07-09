import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { parseEther } from 'viem';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Fixed historic series: latest datapoint is 2026-07-01. The 2026-04-01 point is
// within the trailing 183 days; the 2025-06-01 point is outside it and must be
// excluded from the mean. Mean of the included borrowRates = (0.10 + 0.20) / 2.
const HISTORIC = [
  { datetime: '2026-07-01T00:00:00Z', borrowRate: 0.1, tvl: 1000, numberOfUrns: 50 },
  { datetime: '2026-04-01T00:00:00Z', borrowRate: 0.2, tvl: 900, numberOfUrns: 40 },
  { datetime: '2025-06-01T00:00:00Z', borrowRate: 0.99, tvl: 500, numberOfUrns: 10 }
];

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeHistoricData: () => ({ data: HISTORIC, isLoading: false, error: null }),
    useCollateralData: () => ({
      data: { stabilityFee: parseEther('0.05') },
      isLoading: false,
      error: null
    })
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
  it('averages only the borrow rates within the trailing 6 months of the latest point', () => {
    expect(calculateTrailing6MonthRate(HISTORIC)).toBeCloseTo(0.15, 10);
  });

  it('returns null for empty or missing data', () => {
    expect(calculateTrailing6MonthRate([])).toBeNull();
    expect(calculateTrailing6MonthRate(undefined)).toBeNull();
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

  it('renders the trailing-6-month mean rate computed from the historic series', () => {
    renderStrip();

    // (0.10 + 0.20) / 2 = 0.15 -> 15.00%
    expect(screen.getByText('15.00%')).toBeTruthy();
  });

  it('renders the static Unlimited liquidity value', () => {
    renderStrip();

    expect(screen.getByText('Unlimited')).toBeTruthy();
  });
});
