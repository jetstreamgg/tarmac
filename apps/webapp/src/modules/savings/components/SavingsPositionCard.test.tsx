import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

// Mutable savings balance — drives which card the router renders. An unresolved
// read (data undefined) holds the slot: skeleton while in flight, error card if
// the read failed.
const h = vi.hoisted(() => ({
  savingsBalance: 0n as bigint,
  savingsUnresolved: false,
  savingsError: null as Error | null,
  launch: vi.fn()
}));

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
      data: h.savingsUnresolved
        ? undefined
        : { userSavingsBalance: h.savingsBalance, userNstBalance: 0n, savingsRate: 0n, savingsTvl: 0n },
      error: h.savingsError,
      isLoading: h.savingsUnresolved && !h.savingsError,
      mutate: vi.fn(),
      dataSources: []
    }),
    useTokenBalance: () => ({ data: { value: 0n }, refetch: vi.fn() }),
    useOverallSkyData: () => ({ data: { skySavingsRatecRate: '0.0375' } })
  };
});

// The live-accrual rate would otherwise reach for the chain (sUSDS `ssr`).
// 3.75% expressed per second.
vi.mock('../hooks/useSavingsAccrualRate', () => ({
  useSavingsAccrualRate: () => Math.expm1(Math.log1p(0.0375) / (365 * 24 * 60 * 60))
}));

// Stub the leaf cards/bodies — routing is the unit under test, not their internals.
vi.mock('./SavingsSupplyCard', () => ({
  SavingsSupplyCard: () => <div data-testid="savings-supply-card" />
}));
vi.mock('./SavingsModalForm', () => ({
  SavingsModalForm: ({ flow }: { flow: string }) => <div data-testid={`mock-modal-form-${flow}`} />
}));

// The has-position card opens the shared modal via launch() — capture it.
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: h.launch,
    updateModalContent: vi.fn(),
    isModalOpen: false,
    txCallbacks: { onMutate: vi.fn(), onStart: vi.fn(), onSuccess: vi.fn(), onError: vi.fn() },
    txStatus: 'idle'
  })
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
    h.savingsUnresolved = false;
    h.savingsError = null;
    h.launch.mockClear();
  });
  afterEach(() => cleanup());

  it('holds the slot with a skeleton while the position read is in flight', () => {
    h.savingsUnresolved = true;
    renderCard();

    expect(screen.queryByTestId('savings-position-card-skeleton')).not.toBeNull();
    expect(screen.queryByTestId('savings-supply-card')).toBeNull();
    expect(screen.queryByTestId('savings-position-card')).toBeNull();
  });

  it('settles a failed position read on the error card, not an endless skeleton', () => {
    h.savingsUnresolved = true;
    h.savingsError = new Error('read failed');
    renderCard();

    expect(screen.queryByTestId('savings-position-card-error')).not.toBeNull();
    expect(screen.queryByTestId('savings-position-card-skeleton')).toBeNull();
    expect(screen.queryByTestId('savings-supply-card')).toBeNull();
  });

  it('renders the no-position "Supply" card when the savings balance is zero', () => {
    h.savingsBalance = 0n;
    renderCard();

    expect(screen.queryByTestId('savings-supply-card')).not.toBeNull();
    expect(screen.queryByTestId('savings-position-card')).toBeNull();
  });

  it('renders the "My position" card with Supply and Withdraw buttons when the savings balance is positive', () => {
    h.savingsBalance = 100n * 10n ** 18n;
    renderCard();

    expect(screen.queryByTestId('savings-position-card')).not.toBeNull();
    expect(screen.queryByTestId('savings-supply-card')).toBeNull();
    expect(screen.queryByTestId('savings-position-supply')).not.toBeNull();
    expect(screen.queryByTestId('savings-position-withdraw')).not.toBeNull();
  });

  it('hands the hero the SSR, so the position accrues on screen', () => {
    h.savingsBalance = 100n * 10n ** 18n;
    renderCard();

    // 100 USDS at 3.75% earns its 7th decimal about once a second, so that's
    // the digit the counter rolls — padded, not trimmed, so it can't reflow.
    expect(screen.getByTestId('rolling-digits').textContent).toBe('0000000');
  });

  it('opens the "Supply to Sky Savings" editable modal (entry descriptor) on Supply', () => {
    h.savingsBalance = 100n * 10n ** 18n;
    renderCard();

    fireEvent.click(screen.getByTestId('savings-position-supply'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const config = h.launch.mock.calls[0][0];
    expect(config.title).toBe('Supply to Sky Savings');
    // The wallet/status screen reads "Confirm in the wallet" (Figma 527:8273).
    expect(config.transactionTitle).toBe('Confirm in the wallet');
    // It's the editable entry flow, not a read-only review.
    expect(config.entry).toBeDefined();
    expect(config.entry.confirmLabel).toBe('Review');
    expect(config.entry.confirmDisabled).toBe(true);
    // The editable body is hosted OUTSIDE the dialog (backgroundContent) so its
    // in-flight hook survives minimize — not inside entry.content.
    expect(config.entry.content).toBeUndefined();
    expect(config.backgroundContent).toBeDefined();
    expect(config.backgroundContent.props.flow).toBe('supply');
  });

  it('opens the "Withdraw from Sky Savings" editable modal (entry descriptor) on Withdraw', () => {
    h.savingsBalance = 100n * 10n ** 18n;
    renderCard();

    fireEvent.click(screen.getByTestId('savings-position-withdraw'));

    expect(h.launch).toHaveBeenCalledTimes(1);
    const config = h.launch.mock.calls[0][0];
    expect(config.title).toBe('Withdraw from Sky Savings');
    expect(config.transactionTitle).toBe('Confirm in the wallet');
    expect(config.entry).toBeDefined();
    expect(config.entry.confirmLabel).toBe('Review');
    expect(config.entry.confirmDisabled).toBe(true);
    expect(config.entry.content).toBeUndefined();
    expect(config.backgroundContent).toBeDefined();
    expect(config.backgroundContent.props.flow).toBe('withdraw');
  });
});
