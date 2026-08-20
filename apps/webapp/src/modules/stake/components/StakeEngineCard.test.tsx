import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetSearchParams } from '@/lib/navigation';

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

// Rewards-rate + collateral (min-borrow) reads are mocked to fixed values.
const DUST_RAD = 10000n * 10n ** 45n; // 10,000 USDS expressed in RAD (45 decimals)

// Inline token icons pull image hooks we don't exercise here; stub to null so the
// headline/stat text content stays clean (same pattern the shell test uses).
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeRewardContracts: () => ({ data: [], isLoading: false }),
    useMultipleRewardsChartInfo: () => ({ data: [], isLoading: false }),
    useHighestRateFromChartData: () => ({ rate: '0.075' }),
    useCollateralData: () => ({ data: { dust: DUST_RAD }, isLoading: false, error: null })
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
  });

  afterEach(cleanup);

  it('renders the eyebrow, headline, and both stats', () => {
    renderCard();

    expect(screen.getByTestId('stake-engine-card')).toBeTruthy();
    expect(screen.getByText('Sky Staking Engine')).toBeTruthy();
    // Headline embeds inline SKY/USDS icons (stubbed to null), so assert the
    // whitespace-normalized text rather than a single text node.
    expect(screen.getByTestId('stake-engine-headline').textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Stake SKY to accrue rewards, delegate votes and borrow USDS'
    );
    // Rewards rate from the mocked highest rate (0.075 -> 7.50%).
    expect(screen.getByText('7.50%')).toBeTruthy();
    // Min. borrow amount: dust (RAD) converted to WAD. The comp tags the
    // figure with the USDS mark instead of spelling the symbol out.
    expect(screen.getByText('10,000')).toBeTruthy();
  });

  it('routes the CTA through connect-then-act and sets flow=open with replace', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('stake-open-position-cta'));

    // The wrapped action was handed to useConnectThenAct and, on the connected
    // path, ran — writing the flow param.
    expect(connectThenActSpy).toHaveBeenCalledTimes(1);
    expect(setSearchParamsMock).toHaveBeenCalledTimes(1);
    expect(setSearchParamsMock.mock.calls[0][1]).toEqual({ replace: true });
    expect(mockSearchParams.get('flow')).toBe('open');
  });
});
