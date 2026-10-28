import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_VALUE } from '@/lib/constants';

i18n.load('en', {});
i18n.activate('en');

// Historic series feeding the Total SKY staked / TVL / Users rows (newest point
// by datetime). Its borrowRate only proves the Borrow Rate row ignores it: that
// row reads the onchain stability fee (APP-640).
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

// Onchain collateral read: capped OSM price + a 6.65% annualized stability fee
// (WAD ratio), distinct from the historic 8.1%. Reset per test.
const COLLATERAL = { delayedPrice: 60_000_000_000_000_000n, stabilityFee: 665n * 10n ** 14n };
let collateral: { data?: typeof COLLATERAL; isLoading: boolean; error: Error | null };

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

vi.mock('@/hooks/stake/useStakeHistoricData', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/stake/useStakeHistoricData')>();
  return {
    ...actual,
    useStakeHistoricData: () => ({ data: HISTORIC, isLoading: false, error: null })
  };
});
vi.mock('@/hooks/vaults/useCollateralData', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/vaults/useCollateralData')>();
  return {
    ...actual,
    useCollateralData: () => collateral
  };
});
vi.mock('@/hooks/stake/useStakeRewardContracts', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/stake/useStakeRewardContracts')>();
  return {
    ...actual,
    useStakeRewardContracts: () => ({ data: [{ contractAddress: '0xfarm' }], isLoading: false })
  };
});
vi.mock('@/hooks/rewards/useMultipleRewardsChartInfo', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/rewards/useMultipleRewardsChartInfo')>();
  return {
    ...actual,
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

// The value cell of a Details row, found from its label.
const rowValue = (label: string) => screen.getByText(label).closest('div')?.lastElementChild;

describe('StakeDetailsStrip', () => {
  beforeEach(() => {
    collateral = { data: COLLATERAL, isLoading: false, error: null };
  });

  afterEach(cleanup);

  it('renders all six detail labels per the comp (1036:208698)', () => {
    renderStrip();

    expect(screen.getByTestId('stake-details-strip')).toBeTruthy();
    expect(screen.getByText('Staking Reward Rate')).toBeTruthy();
    expect(screen.getByText('Borrow Rate')).toBeTruthy();
    expect(screen.getByText('Total SKY staked')).toBeTruthy();
    expect(screen.getByText('TVL')).toBeTruthy();
    expect(screen.getByText('Capped OSM SKY price')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
  });

  it('renders the latest rewards rate as the Staking Reward Rate', () => {
    renderStrip();

    // Latest farm datapoint: 0.10 -> 10.00%.
    expect(screen.getByText('10.00%')).toBeTruthy();
  });

  it('renders the onchain borrow rate, not the lagging historic one (APP-640)', () => {
    renderStrip();

    expect(rowValue('Borrow Rate')?.textContent).toBe('6.65%');
    expect(screen.queryByText('8.10%')).toBeNull();
  });

  it('holds the Borrow Rate row on the onchain read: skeleton while loading, dash on error', () => {
    collateral = { data: undefined, isLoading: true, error: null };
    renderStrip();
    expect(rowValue('Borrow Rate')?.textContent).toBe('');
    expect(rowValue('Borrow Rate')?.firstElementChild?.className).toContain('bg-skeletonTrack');
    cleanup();

    collateral = { data: undefined, isLoading: false, error: new Error('jug read failed') };
    renderStrip();
    expect(rowValue('Borrow Rate')?.textContent).toBe(NO_VALUE);
    expect(screen.queryByText('8.10%')).toBeNull();
  });

  it('renders the latest historic total staked, TVL and users', () => {
    renderStrip();

    expect(screen.getByText('17,106,043,933')).toBeTruthy();
    expect(screen.getByText('$1,000')).toBeTruthy();
    expect(screen.getByText('50')).toBeTruthy();
  });

  it('shows the onchain capped OSM price, not the indexer price', () => {
    renderStrip();

    expect(screen.getByText('$0.0600')).toBeTruthy();
    expect(screen.queryByText('$0.0804')).toBeNull();
  });
});
