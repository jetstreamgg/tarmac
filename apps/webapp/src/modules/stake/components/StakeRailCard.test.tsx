import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="stake-rail-skeleton-stub" />
}));
vi.mock('./StakeSummaryCard', () => ({
  StakeSummaryCard: () => <div data-testid="stake-summary-card-stub" />
}));
vi.mock('./StakeEngineCard', () => ({
  StakeEngineCard: () => <div data-testid="stake-engine-card-stub" />
}));

import { StakeRailCard } from './StakeRailCard';

i18n.load('en', {});
i18n.activate('en');

describe('StakeRailCard', () => {
  afterEach(cleanup);

  it('holds a skeleton while positions load', () => {
    render(
      <I18nProvider i18n={i18n}>
        <StakeRailCard positions={undefined} isLoading />
      </I18nProvider>
    );

    expect(screen.getByTestId('stake-rail-card-loading')).toBeTruthy();
    expect(screen.getAllByTestId('stake-rail-skeleton-stub').length).toBeGreaterThan(1);
    expect(screen.queryByTestId('stake-summary-card-stub')).toBeNull();
    expect(screen.queryByTestId('stake-engine-card-stub')).toBeNull();
  });

  it('shows the summary card when the user has positions', () => {
    const positions: StakeUserPosition[] = [
      {
        index: 0,
        urnAddress: '0x1111111111111111111111111111111111111111',
        skyLocked: 1n,
        usdsDebt: 0n,
        barks: [],
        lastMutationTimestamp: undefined
      }
    ];
    render(<StakeRailCard positions={positions} isLoading={false} />);

    expect(screen.getByTestId('stake-summary-card-stub')).toBeTruthy();
    expect(screen.queryByTestId('stake-engine-card-stub')).toBeNull();
  });

  it('falls back to the engine promo card with no positions', () => {
    render(<StakeRailCard positions={[]} isLoading={false} />);

    expect(screen.getByTestId('stake-engine-card-stub')).toBeTruthy();
    expect(screen.queryByTestId('stake-summary-card-stub')).toBeNull();
  });
});
