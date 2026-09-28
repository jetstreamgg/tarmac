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

vi.mock('../hooks/useStakeEstAnnualRewardsUsd', () => ({
  useStakeEstAnnualRewardsUsd: () => ({ data: 11258.25, isLoading: false })
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
    useStakeHistory: () => ({ data: [], isLoading: false, error: null })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

// Live Vat debt read: undefined here, so the card falls back to the subgraph
// principal — the totals under test stay driven by the positions fixture.
vi.mock('../hooks/useStakeTotalDebt', () => ({
  useStakeTotalDebt: () => ({ data: undefined, isLoading: false, error: null })
}));

import { StakeSummaryCard } from './StakeSummaryCard';

const POSITIONS: StakeUserPosition[] = [
  {
    index: 0,
    urnAddress: '0x1111111111111111111111111111111111111111',
    skyLocked: 700550n * 10n ** 18n,
    usdsDebt: 30000n * 10n ** 18n,
    barks: [],
    lastMutationTimestamp: undefined
  },
  {
    index: 1,
    urnAddress: '0x1111111111111111111111111111111111111111',
    skyLocked: 50000n * 10n ** 18n,
    usdsDebt: 0n,
    barks: [],
    lastMutationTimestamp: undefined
  }
];

const renderCard = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakeSummaryCard positions={POSITIONS} />
    </I18nProvider>
  );

describe('StakeSummaryCard', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    setSearchParamsMock.mockClear();
  });

  afterEach(cleanup);

  it('renders aggregate totals from the positions', () => {
    renderCard();

    expect(screen.getByTestId('stake-summary-card')).toBeTruthy();
    // Hero: 750,550 SKY staked, ~$750,550.00 at the mocked $1 price.
    expect(screen.getByText('750,550.00')).toBeTruthy();
    expect(screen.getByText('~$750,550.00')).toBeTruthy();
    // Total borrowed: a USDS amount, not USD.
    expect(screen.getByTestId('stake-summary-borrowed').textContent).toBe('30,000.00');
    expect(screen.getByTestId('stake-summary-est-earnings').textContent).toBe('$11,258.25');
    // Claimable rewards and (with empty claim history) rewards earned: $17.90.
    expect(screen.getAllByText('$17.90').length).toBe(2);
  });

  it('renders a zero total with the stake zero convention (0.00, not 0)', () => {
    render(
      <I18nProvider i18n={i18n}>
        <StakeSummaryCard
          positions={[
            {
              index: 0,
              urnAddress: '0x1111111111111111111111111111111111111111',
              skyLocked: 0n,
              usdsDebt: 0n,
              barks: [],
              lastMutationTimestamp: undefined
            }
          ]}
        />
      </I18nProvider>
    );
    // Hero and Total borrowed.
    expect(screen.getAllByText('0.00').length).toBe(2);
  });

  it('drops Net APY and the open-position CTA', () => {
    renderCard();

    expect(screen.queryByText('Net APY')).toBeNull();
    expect(screen.queryByTestId('stake-open-new-position-cta')).toBeNull();
  });

  it('Manage opens the positions tab when there are several urns', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('stake-summary-manage-cta'));

    expect(mockSearchParams.get('tab')).toBe('positions');
    expect(mockSearchParams.get('flow')).toBeNull();
  });

  it('Manage opens the manage modal for a single urn', () => {
    render(
      <I18nProvider i18n={i18n}>
        <StakeSummaryCard positions={[POSITIONS[1]]} />
      </I18nProvider>
    );

    fireEvent.click(screen.getByTestId('stake-summary-manage-cta'));

    expect(mockSearchParams.get('flow')).toBe('manage');
    expect(mockSearchParams.get('urn_index')).toBe('1');
  });
});
