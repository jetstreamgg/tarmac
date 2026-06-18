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
  update: vi.fn(),
  // Latest params the form passed to useSavingsLaunch (flow / max / amount wiring).
  launchParams: undefined as { flow?: string; max?: boolean; amount?: bigint } | undefined
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
    // The savings position (drives the withdraw balance/Max).
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

// The engine seam — stubbed so the form mounts without real wagmi writes. Records
// the params so the withdraw flow + Max → max flag wiring can be asserted.
vi.mock('../hooks/useSavingsLaunch', () => ({
  useSavingsLaunch: (params: { flow: string; max?: boolean; amount: bigint }) => {
    h.launchParams = params;
    return {
      launch: vi.fn(),
      execute: h.execute,
      steps: ['Supply'],
      prepared: h.prepared,
      isLoading: false,
      error: null
    };
  }
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ updateModalContent: h.update })
}));

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { SavingsModalForm } from './SavingsModalForm';
import type { SavingsLaunchFlow } from '../hooks/useSavingsLaunch';

const renderForm = (flow: SavingsLaunchFlow) =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsModalForm sessionId="s1" flow={flow} />
    </I18nProvider>
  );

// The last entry.confirmDisabled pushed to the modal.
const lastDisabled = () => {
  const withEntry = h.update.mock.calls.filter(([, patch]) => patch?.entry?.confirmDisabled !== undefined);
  return withEntry.at(-1)?.[1].entry.confirmDisabled;
};

const FIGMA_ROWS = ['Savings rate', 'Supply', '1Y est. earnings', 'Network', 'Network fee'];

describe('SavingsModalForm — Supply to Sky Savings entry body', () => {
  beforeEach(() => {
    h.walletBalance = 100n * 10n ** 18n;
    h.prepared = true;
    h.execute.mockClear();
    h.update.mockClear();
  });
  afterEach(() => cleanup());

  it('renders the amount input and the exact Figma supply row set', () => {
    renderForm('supply');
    expect(screen.queryByTestId('savings-modal-amount-input')).not.toBeNull();
    for (const label of FIGMA_ROWS) {
      expect(screen.queryByTestId(`savings-modal-row-${label}`)).not.toBeNull();
    }
  });

  it('routes the supply flow to useSavingsLaunch', () => {
    renderForm('supply');
    expect(h.launchParams?.flow).toBe('supply');
  });

  it('syncs confirmDisabled=true to the modal while the amount is zero', () => {
    renderForm('supply');
    expect(lastDisabled()).toBe(true);
  });

  it('enables the confirm (confirmDisabled=false) once a valid amount is entered', () => {
    renderForm('supply');
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '5' } });
    expect(lastDisabled()).toBe(false);
  });

  it('keeps the confirm disabled and flags an error when the amount exceeds the balance', () => {
    h.walletBalance = 1n * 10n ** 18n; // only 1 USDS
    renderForm('supply');
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '5' } });
    expect(lastDisabled()).toBe(true);
    expect(screen.queryByTestId('savings-modal-amount-error')).not.toBeNull();
  });
});

describe('SavingsModalForm — Withdraw from Sky Savings entry body', () => {
  beforeEach(() => {
    // A small wallet balance proves withdraw caps on the position, not the wallet.
    h.walletBalance = 1n * 10n ** 18n;
    h.prepared = true;
    h.execute.mockClear();
    h.update.mockClear();
  });
  afterEach(() => cleanup());

  it('renders the amount input and the exact Figma withdraw row set', () => {
    renderForm('withdraw');
    expect(screen.queryByTestId('savings-modal-amount-input')).not.toBeNull();
    for (const label of FIGMA_ROWS) {
      expect(screen.queryByTestId(`savings-modal-row-${label}`)).not.toBeNull();
    }
  });

  it('routes the withdraw flow to useSavingsLaunch', () => {
    renderForm('withdraw');
    expect(h.launchParams?.flow).toBe('withdraw');
  });

  it('caps on the savings position, not the wallet balance', () => {
    renderForm('withdraw');
    // 50 ≤ 100 (position) is valid even though the wallet only holds 1 USDS.
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '50' } });
    expect(lastDisabled()).toBe(false);
    expect(screen.queryByTestId('savings-modal-amount-error')).toBeNull();
  });

  it('disables the confirm and flags an error when the amount exceeds the position', () => {
    renderForm('withdraw');
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '200' } });
    expect(lastDisabled()).toBe(true);
    expect(screen.queryByTestId('savings-modal-amount-error')).not.toBeNull();
  });

  it('Max fills the whole position and sets the max flag (no-dust redeem)', () => {
    renderForm('withdraw');
    fireEvent.click(screen.getByTestId('savings-modal-amount-max'));

    expect((screen.getByTestId('savings-modal-amount-input') as HTMLInputElement).value).toBe('100');
    expect(h.launchParams?.max).toBe(true);
    expect(lastDisabled()).toBe(false);
  });

  it('clears the max flag once the user edits the amount', () => {
    renderForm('withdraw');
    fireEvent.click(screen.getByTestId('savings-modal-amount-max'));
    expect(h.launchParams?.max).toBe(true);

    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '50' } });
    expect(h.launchParams?.max).toBe(false);
  });
});
