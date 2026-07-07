import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';

i18n.load('en', {});
i18n.activate('en');

let mockPositions: {
  data?: StakeUserPosition[];
  isLoading: boolean;
  error: Error | null;
} = { data: [], isLoading: false, error: null };

vi.mock('../hooks/useStakeUserPositions', async importOriginal => {
  const actual = await importOriginal<typeof import('../hooks/useStakeUserPositions')>();
  return {
    ...actual,
    useStakeUserPositions: () => ({ ...mockPositions, mutate: vi.fn() })
  };
});

vi.mock('./StakePositionsTable', () => ({
  StakePositionsTable: () => <div data-testid="stake-positions-table-stub" />
}));
vi.mock('./StakeSummaryCard', () => ({
  StakeSummaryCard: () => <div data-testid="stake-summary-card-stub" />
}));
vi.mock('./StakeActivityTable', () => ({
  StakeActivityTable: () => <div data-testid="stake-activity-table-stub" />
}));
vi.mock('./StakeEngineCard', () => ({
  StakeEngineCard: () => <div data-testid="stake-engine-card-stub" />
}));

import { StakePositionsTab } from './StakePositionsTab';

const renderTab = () =>
  render(
    <I18nProvider i18n={i18n}>
      <StakePositionsTab />
    </I18nProvider>
  );

describe('StakePositionsTab', () => {
  afterEach(cleanup);

  it('shows the summary card in the rail when the user has positions', () => {
    mockPositions = {
      data: [{ index: 0, skyLocked: 1n, usdsDebt: 0n }],
      isLoading: false,
      error: null
    };
    renderTab();

    expect(screen.getByTestId('stake-positions-tab')).toBeTruthy();
    expect(screen.getByTestId('stake-positions-table-stub')).toBeTruthy();
    expect(screen.getByTestId('stake-activity-table-stub')).toBeTruthy();
    expect(screen.getByTestId('stake-summary-card-stub')).toBeTruthy();
    expect(screen.queryByTestId('stake-engine-card-stub')).toBeNull();
  });

  it('falls back to the engine promo card when there are no positions', () => {
    mockPositions = { data: [], isLoading: false, error: null };
    renderTab();

    expect(screen.getByTestId('stake-engine-card-stub')).toBeTruthy();
    expect(screen.queryByTestId('stake-summary-card-stub')).toBeNull();
  });

  it('holds the rail on a skeleton while positions load', () => {
    mockPositions = { data: undefined, isLoading: true, error: null };
    renderTab();

    expect(screen.queryByTestId('stake-engine-card-stub')).toBeNull();
    expect(screen.queryByTestId('stake-summary-card-stub')).toBeNull();
  });
});
