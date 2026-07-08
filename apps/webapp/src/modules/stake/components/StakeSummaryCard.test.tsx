import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetSearchParams } from '@/lib/navigation';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';

i18n.load('en', {});
i18n.activate('en');

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

const connectThenActSpy = vi.fn();
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({
  useConnectThenAct: (action: () => void) => {
    connectThenActSpy(action);
    return action;
  }
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: '0xabcabcabcabcabcabcabcabcabcabcabcabcabca' })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useSkyPrice: () => ({ data: 10n ** 18n, priceString: '1', isLoading: false, error: null }),
    useAllStakeUrnAddresses: () => ({
      data: ['0x1111111111111111111111111111111111111111'],
      isLoading: false
    }),
    useStakeRewardContracts: () => ({
      data: [{ contractAddress: '0x2222222222222222222222222222222222222222' }],
      isLoading: false
    }),
    useRewardContractsToClaim: () => ({
      data: [
        {
          contractAddress: '0x2222222222222222222222222222222222222222',
          claimBalance: 17900000000000000000n, // 17.9 SKY
          rewardSymbol: 'SKY'
        }
      ],
      isLoading: false
    }),
    usePrices: () => ({ data: { SKY: { price: '1' } }, isLoading: false, error: null }),
    useStakeHistory: () => ({ data: [], isLoading: false, error: null }),
    useMultipleRewardsChartInfo: () => ({ data: [], isLoading: false }),
    useHighestRateFromChartData: () => ({ rate: '0.015' }),
    useStakeHistoricData: () => ({
      data: [{ datetime: '2026-07-06T00:00:00Z', borrowRate: 0.081 }],
      isLoading: false,
      error: null
    })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

// Live Vat debt read: undefined here, so the card falls back to the subgraph
// principal — the totals under test stay driven by the positions fixture.
vi.mock('../hooks/useStakeTotalDebt', () => ({
  useStakeTotalDebt: () => ({ data: undefined, isLoading: false, error: null })
}));

import { StakeSummaryCard, calculateNetApy } from './StakeSummaryCard';

const POSITIONS: StakeUserPosition[] = [
  { index: 0, skyLocked: 700550n * 10n ** 18n, usdsDebt: 30000n * 10n ** 18n, barks: [], lastMutationTimestamp: undefined },
  { index: 1, skyLocked: 50000n * 10n ** 18n, usdsDebt: 0n, barks: [], lastMutationTimestamp: undefined }
];

const renderCard = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeSummaryCard positions={POSITIONS} />
    </I18nProvider>
  );

describe('calculateNetApy', () => {
  it('is the borrow-cost-weighted net of the rewards rate (BL-13)', () => {
    // (0.015 * 1000 - 0.08 * 500) / 1000 = -0.025
    expect(
      calculateNetApy({ rewardsRate: 0.015, borrowRate: 0.08, stakedUsd: 1000, borrowedUsd: 500 })
    ).toBeCloseTo(-0.025);
  });

  it('equals the rewards rate when nothing is borrowed', () => {
    expect(
      calculateNetApy({ rewardsRate: 0.015, borrowRate: 0.08, stakedUsd: 1000, borrowedUsd: 0 })
    ).toBeCloseTo(0.015);
  });

  it('is null without a rewards rate or without stake', () => {
    expect(calculateNetApy({ rewardsRate: null, borrowRate: 0.08, stakedUsd: 1000, borrowedUsd: 0 })).toBe(
      null
    );
    expect(calculateNetApy({ rewardsRate: 0.015, borrowRate: 0.08, stakedUsd: 0, borrowedUsd: 0 })).toBe(
      null
    );
  });
});

describe('StakeSummaryCard', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    setSearchParamsMock.mockClear();
    connectThenActSpy.mockClear();
  });

  afterEach(cleanup);

  it('renders aggregate totals from the positions', () => {
    renderCard();

    expect(screen.getByTestId('stake-summary-card')).toBeTruthy();
    // Hero: 750,550 SKY staked, ~$750,550.00 at the mocked $1 price.
    expect(screen.getByText('750,550')).toBeTruthy();
    expect(screen.getByText('~$750,550.00')).toBeTruthy();
    // Total borrowed: 30,000 USDS ≈ $30,000.00.
    expect(screen.getByText('$30,000.00')).toBeTruthy();
    // Claimable rewards and (with empty claim history) rewards earned: $17.90.
    expect(screen.getAllByText('$17.90').length).toBe(2);
  });

  it('renders the signed Net APY including negative values as-is', () => {
    renderCard();

    // (0.015 * 750550 - 0.081 * 30000) / 750550 = 0.01176... -> +1.18%
    expect(screen.getByTestId('stake-summary-net-apy').textContent).toBe('+1.18%');
  });

  it('routes the CTA through connect-then-act and stubs flow=open', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('stake-open-new-position-cta'));

    expect(connectThenActSpy).toHaveBeenCalled();
    expect(mockSearchParams.get('flow')).toBe('open');
  });
});
