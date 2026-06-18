import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

// Mutable savings balance — drives which card the router renders.
const h = vi.hoisted(() => ({ savingsBalance: 0n as bigint }));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useSavingsData: () => ({
      data: { userSavingsBalance: h.savingsBalance, userNstBalance: 0n, savingsRate: 0n, savingsTvl: 0n },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      dataSources: []
    }),
    useTokenBalance: () => ({ data: { value: 0n }, refetch: vi.fn() })
  };
});

// Stub the input body — routing is the unit under test, not the panel internals.
vi.mock('./SavingsSupplyWithdrawPanel', () => ({
  SavingsSupplyWithdrawPanel: () => <div data-testid="mock-panel" />
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({
  TokenIcon: () => null
}));

import { SavingsPositionCard } from './SavingsPositionCard';

const renderCard = () =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsPositionCard />
    </I18nProvider>
  );

describe('SavingsPositionCard — position routing', () => {
  beforeEach(() => {
    h.savingsBalance = 0n;
  });
  afterEach(() => cleanup());

  it('renders the no-position "Supply" card when the savings balance is zero', () => {
    h.savingsBalance = 0n;
    renderCard();

    expect(screen.queryByTestId('savings-supply-card')).not.toBeNull();
    expect(screen.queryByTestId('savings-position-card')).toBeNull();
  });

  it('renders the "My position" card when the savings balance is positive', () => {
    h.savingsBalance = 100n * 10n ** 18n;
    renderCard();

    expect(screen.queryByTestId('savings-position-card')).not.toBeNull();
    expect(screen.queryByTestId('savings-supply-card')).toBeNull();
  });
});
