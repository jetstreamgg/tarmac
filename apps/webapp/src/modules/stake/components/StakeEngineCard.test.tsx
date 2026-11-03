import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetSearchParams } from '@/lib/navigation';
import { NO_VALUE } from '@/lib/constants';

i18n.load('en', {});
i18n.activate('en');

// Search-param state controlled directly (same shape StakeProductPage.test uses).
let mockSearchParams = new URLSearchParams();
const setSearchParamsMock = vi.fn<SetSearchParams>(next => {
  mockSearchParams =
    typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
});

vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return {
    ...actual,
    useAppSearchParams: () => [mockSearchParams, setSearchParamsMock]
  };
});

// Simulate the connected path: the wrapped action runs immediately on click, so
// clicking the CTA exercises the flow=open write directly.
const connectThenActSpy = vi.fn();
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({
  useConnectThenAct: (action: () => void) => {
    connectThenActSpy(action);
    return action;
  }
}));

// Rewards-rate and collateral (borrow-rate + min-borrow) reads are mocked to
// fixed values.
const DUST_RAD = 10000n * 10n ** 45n; // 10,000 USDS expressed in RAD (45 decimals)
const STABILITY_FEE_WAD = 665n * 10n ** 14n; // 6.65% annualized, as a WAD ratio
const COLLATERAL = { dust: DUST_RAD, stabilityFee: STABILITY_FEE_WAD };
// Per-test overrides for the missing-value cases; reset in beforeEach.
let highestRate: { rate: string } | null = { rate: '0.075' };
let collateral: { data?: typeof COLLATERAL; isLoading: boolean; error: Error | null } = {
  data: COLLATERAL,
  isLoading: false,
  error: null
};

// Inline token icons pull image hooks we don't exercise here; stub to null so the
// headline/stat text content stays clean (same pattern the shell test uses).
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeRewardContracts: () => ({ data: [], isLoading: false }),
    useMultipleRewardsChartInfo: () => ({ data: [], isLoading: false }),
    useHighestRateFromChartData: () => highestRate,
    useCollateralData: () => collateral
  };
});

import { StakeEngineCard } from './StakeEngineCard';

const renderCard = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeEngineCard />
    </I18nProvider>
  );

describe('StakeEngineCard', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    setSearchParamsMock.mockClear();
    connectThenActSpy.mockClear();
    highestRate = { rate: '0.075' };
    collateral = { data: COLLATERAL, isLoading: false, error: null };
  });

  afterEach(cleanup);

  it('renders the eyebrow, headline, and all three stats', () => {
    renderCard();

    expect(screen.getByTestId('stake-engine-card')).toBeTruthy();
    expect(screen.getByText('Sky Staking Engine')).toBeTruthy();
    // Headline embeds inline SKY/USDS icons (stubbed to null), so assert the
    // whitespace-normalized text rather than a single text node.
    expect(screen.getByTestId('stake-engine-headline').textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Stake SKY to accrue rewards, delegate votes and borrow USDS'
    );
    // Rewards rate from the mocked highest rate (0.075 -> 7.50%), the best of
    // the farms, hence "up to".
    expect(screen.getByText('up to 7.50%')).toBeTruthy();
    // Borrow rate: the onchain annualized stability fee, as the open flow shows it.
    expect(screen.getByText('6.65%')).toBeTruthy();
    // Min. borrow amount: dust (RAD) converted to WAD. The comp tags the
    // figure with the USDS mark instead of spelling the symbol out.
    expect(screen.getByText('10,000.00')).toBeTruthy();
  });

  it('puts the rate explainers on the rate labels, not on min. borrow amount', () => {
    renderCard();

    const stats = screen.getByTestId('stake-engine-stats');
    expect(stats.children).toHaveLength(3);
    const [rewards, borrow, minBorrow] = Array.from(stats.children);
    expect(rewards.querySelector('button[aria-label="Show additional information"]')).toBeTruthy();
    expect(borrow.querySelector('button[aria-label="Show additional information"]')).toBeTruthy();
    expect(minBorrow.querySelector('button')).toBeNull();
    // The glyph lives in the label row, beside its text.
    expect(rewards.firstElementChild?.textContent).toBe('Rewards rate');
    expect(rewards.firstElementChild?.querySelector('button')).toBeTruthy();
  });

  it('holds both collateral-backed stats on skeletons while the onchain read loads', () => {
    collateral = { data: undefined, isLoading: true, error: null };
    renderCard();

    const [rewards, borrow, minBorrow] = Array.from(screen.getByTestId('stake-engine-stats').children);
    expect(rewards.lastElementChild?.textContent).toBe('up to 7.50%');
    for (const stat of [borrow, minBorrow]) {
      expect(stat.lastElementChild?.textContent).toBe('');
      expect(stat.lastElementChild?.firstElementChild?.className).toContain('bg-skeletonTrack');
    }
  });

  it('shows the bare dash, without "up to", when a rate cannot be sourced', () => {
    highestRate = null;
    collateral = { data: undefined, isLoading: false, error: new Error('vat read failed') };
    renderCard();

    const [rewards, borrow, minBorrow] = Array.from(screen.getByTestId('stake-engine-stats').children);
    expect(rewards.lastElementChild?.textContent).toBe(NO_VALUE);
    expect(borrow.lastElementChild?.textContent).toBe(NO_VALUE);
    expect(minBorrow.lastElementChild?.textContent).toBe(NO_VALUE);
    expect(screen.queryByText(/up to/)).toBeNull();
  });

  it('routes the CTA through connect-then-act and sets flow=open with replace, keeping the scroll', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('stake-open-position-cta'));

    // The wrapped action was handed to useConnectThenAct and, on the connected
    // path, ran — writing the flow param.
    expect(connectThenActSpy).toHaveBeenCalledTimes(1);
    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
    expect(setSearchParamsMock.mock.calls[0][1]).toEqual({ replace: true, resetScroll: false });
    expect(mockSearchParams.get('flow')).toBe('open');
  });
});
