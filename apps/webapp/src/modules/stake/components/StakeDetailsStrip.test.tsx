import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

// Historic series feeding the Borrow Rate / Total SKY staked / TVL / Protocol
// SKY Price / Users rows (latest point first by datetime sort in the strip).
const HISTORIC = [
  {
    datetime: '2026-07-01T00:00:00Z',
    borrowRate: 0.081,
    totalSky: 17_106_043_933,
    tvl: 1000,
    skyPrice: 0.0804,
    numberOfUrns: 50
  },
  {
    datetime: '2026-04-01T00:00:00Z',
    borrowRate: 0.2,
    totalSky: 15_000_000_000,
    tvl: 900,
    skyPrice: 0.07,
    numberOfUrns: 40
  }
];

const ts = (date: string) => new Date(date).getTime() / 1000;

// Rewards-rate series: latest point is 2026-07-01 (rate 0.10 -> Staking Reward Rate).
const FARM = [
  { blockTimestamp: ts('2026-07-01'), rate: '0.1' },
  { blockTimestamp: ts('2026-04-01'), rate: '0.2' }
];

// TokenIcon reaches for the wagmi config (chain badge); the strip only needs
// the glyph, so stub it out.
vi.mock('@/modules/ui/components/TokenIcon', () => ({
  TokenIcon: ({ token }: { token: { symbol: string } }) => <span data-testid={`token-icon-${token.symbol}`} />
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeHistoricData: () => ({ data: HISTORIC, isLoading: false, error: null }),
    useStakeRewardContracts: () => ({ data: [{ contractAddress: '0xfarm' }], isLoading: false }),
    useMultipleRewardsChartInfo: () => ({ data: [FARM], isLoading: false, error: null })
  };
});

import { StakeDetailsStrip } from './StakeDetailsStrip';

const renderStrip = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeDetailsStrip />
    </I18nProvider>
  );

describe('StakeDetailsStrip', () => {
  afterEach(cleanup);

  it('renders all six detail labels per the comp (1036:208698)', () => {
    renderStrip();

    expect(screen.getByTestId('stake-details-strip')).toBeTruthy();
    expect(screen.getByText('Staking Reward Rate')).toBeTruthy();
    expect(screen.getByText('Borrow Rate')).toBeTruthy();
    expect(screen.getByText('Total SKY staked')).toBeTruthy();
    expect(screen.getByText('TVL')).toBeTruthy();
    expect(screen.getByText('SKY Price')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
  });

  it('renders the latest rewards rate as the Staking Reward Rate', () => {
    renderStrip();

    // Latest farm datapoint: 0.10 -> 10.00%.
    expect(screen.getByText('10.00%')).toBeTruthy();
  });

  it('renders the latest historic borrow rate, total staked, TVL, price and users', () => {
    renderStrip();

    expect(screen.getByText('8.10%')).toBeTruthy();
    expect(screen.getByText('17,106,043,933')).toBeTruthy();
    expect(screen.getByText('$1,000')).toBeTruthy();
    expect(screen.getByText('$0.0804')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
  });
});
