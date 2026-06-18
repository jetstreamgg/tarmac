import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

const h = vi.hoisted(() => ({
  walletBalance: 0n as bigint,
  prepared: true,
  execute: vi.fn(),
  update: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useSavingsData: () => ({
      data: { userSavingsBalance: 100n * 10n ** 18n, savingsRate: 65n * 10n ** 15n, savingsTvl: 0n },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      dataSources: []
    }),
    useTokenBalance: () => ({ data: { value: h.walletBalance }, refetch: vi.fn() })
  };
});

// The engine seam — stubbed so the form mounts without real wagmi writes.
vi.mock('../hooks/useSavingsLaunch', () => ({
  useSavingsLaunch: () => ({
    launch: vi.fn(),
    execute: h.execute,
    steps: ['Supply'],
    prepared: h.prepared,
    isLoading: false,
    error: null
  })
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ updateModalContent: h.update })
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { SavingsModalSupplyForm } from './SavingsModalSupplyForm';

const renderForm = () =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsModalSupplyForm sessionId="s1" />
    </I18nProvider>
  );

// The last entry.confirmDisabled pushed to the modal.
const lastDisabled = () => {
  const withEntry = h.update.mock.calls.filter(([, patch]) => patch?.entry?.confirmDisabled !== undefined);
  return withEntry.at(-1)?.[1].entry.confirmDisabled;
};

describe('SavingsModalSupplyForm — Supply to Sky Savings entry body', () => {
  beforeEach(() => {
    h.walletBalance = 100n * 10n ** 18n;
    h.prepared = true;
    h.execute.mockClear();
    h.update.mockClear();
  });
  afterEach(() => cleanup());

  it('renders the amount input and the exact Figma supply row set', () => {
    renderForm();
    expect(screen.queryByTestId('savings-modal-amount-input')).not.toBeNull();
    for (const label of ['Savings rate', 'Supply', '1Y est. earnings', 'Network', 'Network fee']) {
      expect(screen.queryByTestId(`supply-row-${label}`)).not.toBeNull();
    }
  });

  it('syncs confirmDisabled=true to the modal while the amount is zero', () => {
    renderForm();
    expect(lastDisabled()).toBe(true);
  });

  it('enables the confirm (confirmDisabled=false) once a valid amount is entered', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '5' } });
    expect(lastDisabled()).toBe(false);
  });

  it('keeps the confirm disabled and flags an error when the amount exceeds the balance', () => {
    h.walletBalance = 1n * 10n ** 18n; // only 1 USDS
    renderForm();
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '5' } });
    expect(lastDisabled()).toBe(true);
    expect(screen.queryByTestId('savings-modal-amount-error')).not.toBeNull();
  });
});
