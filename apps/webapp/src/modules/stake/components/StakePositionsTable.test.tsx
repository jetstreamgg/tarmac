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

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1
  };
});

// Per-row reads: urn address, vault risk, claimable rewards, prices — all
// mocked to fixed values so the table logic is what's under test.
vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useStakeUrnAddress: () => ({ data: '0x1111111111111111111111111111111111111111', isLoading: false }),
    useVault: () => ({ data: { riskLevel: 'LOW' }, isLoading: false, error: null }),
    useStakeRewardContracts: () => ({
      data: [{ contractAddress: '0x2222222222222222222222222222222222222222' }],
      isLoading: false
    }),
    useRewardContractsToClaim: () => ({
      data: [
        {
          contractAddress: '0x2222222222222222222222222222222222222222',
          claimBalance: 128900000000000000000n, // 128.9 SKY
          rewardSymbol: 'SKY'
        }
      ],
      isLoading: false
    }),
    usePrices: () => ({ data: { SKY: { price: '1' } }, isLoading: false, error: null })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { StakePositionsTable } from './StakePositionsTable';

const POSITIONS: StakeUserPosition[] = [
  { index: 0, skyLocked: 700550n * 10n ** 18n, usdsDebt: 30000n * 10n ** 18n },
  { index: 1, skyLocked: 50000n * 10n ** 18n, usdsDebt: 0n },
  { index: 2, skyLocked: 0n, usdsDebt: 0n } // inactive (emptied) urn
];

const renderTable = (positions: StakeUserPosition[] | undefined = POSITIONS, isLoading = false) =>
  render(
    <I18nProvider i18n={i18n}>
      <StakePositionsTable positions={positions} isLoading={isLoading} error={null} />
    </I18nProvider>
  );

describe('StakePositionsTable', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    setSearchParamsMock.mockClear();
  });

  afterEach(cleanup);

  it('renders the heading, one row per position, and 1-based position labels', () => {
    renderTable();

    expect(screen.getByText('Active positions')).toBeTruthy();
    expect(screen.getByTestId('stake-positions-table')).toBeTruthy();
    expect(screen.getByText('Position 1')).toBeTruthy();
    expect(screen.getByText('Position 2')).toBeTruthy();
    // Formatted staked/borrowed amounts.
    expect(screen.getByText('700,550')).toBeTruthy();
    expect(screen.getAllByText('30,000').length).toBeGreaterThan(0);
  });

  it('hides inactive positions by default and shows them when toggled off', () => {
    renderTable();

    // Position 3 is the emptied urn: hidden while the default-on toggle holds.
    expect(screen.queryByText('Position 3')).toBeNull();

    fireEvent.click(screen.getByTestId('stake-hide-inactive-toggle'));

    expect(screen.getByText('Position 3')).toBeTruthy();
  });

  it('stubs the manage flow on row click: flow=manage + urn_index', () => {
    renderTable();

    fireEvent.click(screen.getByTestId('stake-position-row-0'));

    expect(mockSearchParams.get('flow')).toBe('manage');
    expect(mockSearchParams.get('urn_index')).toBe('0');
  });

  it('renders claimable rewards in USD from claim balances and prices', () => {
    renderTable();

    // 128.9 SKY * $1 — one per visible row (both rows share the mocked reads).
    expect(screen.getAllByText('$128.90').length).toBeGreaterThan(0);
  });

  it('renders the empty state when the user has no positions', () => {
    renderTable([]);

    expect(screen.getByTestId('stake-positions-empty')).toBeTruthy();
    expect(screen.getByText("You don't have any staking and borrowing position yet.")).toBeTruthy();
  });
});
