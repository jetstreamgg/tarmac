import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StakeUserPosition } from '../hooks/useStakeUserPositions';

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

describe('StakeRailCard', () => {
  afterEach(cleanup);

  it('holds a skeleton while positions load', () => {
    mockPositions = { data: undefined, isLoading: true, error: null };
    render(<StakeRailCard />);

    expect(screen.getByTestId('stake-rail-skeleton-stub')).toBeTruthy();
    expect(screen.queryByTestId('stake-summary-card-stub')).toBeNull();
    expect(screen.queryByTestId('stake-engine-card-stub')).toBeNull();
  });

  it('shows the summary card when the user has positions', () => {
    mockPositions = {
      data: [
        {
          index: 0,
          urnAddress: '0x1111111111111111111111111111111111111111',
          skyLocked: 1n,
          usdsDebt: 0n,
          barks: [],
          lastMutationTimestamp: undefined
        }
      ],
      isLoading: false,
      error: null
    };
    render(<StakeRailCard />);

    expect(screen.getByTestId('stake-summary-card-stub')).toBeTruthy();
    expect(screen.queryByTestId('stake-engine-card-stub')).toBeNull();
  });

  it('falls back to the engine promo card with no positions', () => {
    mockPositions = { data: [], isLoading: false, error: null };
    render(<StakeRailCard />);

    expect(screen.getByTestId('stake-engine-card-stub')).toBeTruthy();
    expect(screen.queryByTestId('stake-summary-card-stub')).toBeNull();
  });
});
