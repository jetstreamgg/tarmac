import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

// Mutable wallet/connection state shared with the module mocks below.
const h = vi.hoisted(() => ({
  isConnected: true,
  walletBalance: 10n * 10n ** 18n, // 10 USDS
  previewShares: 99n * 10n ** 18n, // sUSDS preview for "You'll receive"
  launch: vi.fn(),
  // Latest params the panel passed to useSavingsLaunch (origin-token routing).
  launchParams: undefined as { originToken?: { symbol?: string } } | undefined
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({
      address: TEST_ADDRESS,
      isConnected: h.isConnected,
      isConnecting: false
    })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useTokenBalance: () => ({ data: { value: h.walletBalance }, refetch: vi.fn() }),
    useSavingsData: () => ({
      data: { userSavingsBalance: 0n, userNstBalance: 0n, savingsRate: 0n, savingsTvl: 0n },
      mutate: vi.fn()
    }),
    useReadSavingsUsds: () => ({ data: h.previewShares }),
    usePreviewSwapExactIn: () => ({ value: 0n }),
    usePreviewSwapExactOut: () => ({ value: 0n })
  };
});

vi.mock('../hooks/useSavingsLaunch', () => ({
  useSavingsLaunch: (params: { originToken?: { symbol?: string } }) => {
    h.launchParams = params;
    return { launch: h.launch, prepared: true, isLoading: false, error: null };
  }
}));

vi.mock('../hooks/useSavingsSupplyMinAmountOut', () => ({
  useSavingsSupplyMinAmountOut: () => 0n
}));

// Stub the origin dropdown as plain option buttons (Radix Select interaction is
// fragile in happy-dom). The real origin constants are preserved so the panel still
// maps the picked symbol → Token and routes to useSavingsLaunch correctly.
vi.mock('./SavingsOriginSelect', async importOriginal => {
  const actual = await importOriginal<typeof import('./SavingsOriginSelect')>();
  return {
    ...actual,
    SavingsOriginSelect: ({
      value,
      options,
      onChange
    }: {
      value: string;
      options: string[];
      onChange: (next: string) => void;
    }) => (
      <div data-testid="savings-origin-select">
        {options.map(symbol => (
          <button
            key={symbol}
            type="button"
            aria-pressed={value === symbol}
            data-testid={`origin-opt-${symbol}`}
            onClick={() => onChange(symbol)}
          >
            {symbol}
          </button>
        ))}
      </div>
    )
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({
  TokenIcon: () => null
}));

import { SavingsSupplyWithdrawPanel } from './SavingsSupplyWithdrawPanel';

const renderSupply = () =>
  render(
    <I18nProvider i18n={i18n}>
      <SavingsSupplyWithdrawPanel flow="supply" projection />
    </I18nProvider>
  );

describe('SavingsSupplyWithdrawPanel — single-flow supply (no-position card)', () => {
  beforeEach(() => {
    h.isConnected = true;
    h.walletBalance = 10n * 10n ** 18n;
    h.previewShares = 99n * 10n ** 18n;
    h.launch.mockClear();
    h.launchParams = undefined;
  });
  afterEach(() => cleanup());

  it('renders single-flow: no Supply/Withdraw tabs and no Withdraw control', () => {
    renderSupply();
    expect(screen.queryByTestId('savings-tab-supply')).toBeNull();
    expect(screen.queryByTestId('savings-tab-withdraw')).toBeNull();
    expect(screen.queryByTestId('position-withdraw')).toBeNull();
    expect(screen.queryByTestId('position-supply')).not.toBeNull();
  });

  it('renders the amount input and the projection rows (You’ll receive, 1Y projected earnings)', () => {
    renderSupply();
    expect(screen.queryByTestId('savings-amount-input')).not.toBeNull();
    expect(screen.queryByTestId('savings-supply-receive')).not.toBeNull();
    expect(screen.queryByTestId('savings-supply-projected-earnings')).not.toBeNull();
  });

  it('disables the input and the CTA while disconnected', () => {
    h.isConnected = false;
    renderSupply();
    expect(screen.getByTestId<HTMLInputElement>('savings-amount-input').disabled).toBe(true);
    expect(screen.getByTestId<HTMLButtonElement>('position-supply').disabled).toBe(true);
  });

  it('disables the CTA when the amount is zero', () => {
    renderSupply();
    expect(screen.getByTestId<HTMLButtonElement>('position-supply').disabled).toBe(true);
  });

  it('disables the CTA and shows an error when the amount exceeds the balance', () => {
    renderSupply();
    fireEvent.change(screen.getByTestId('savings-amount-input'), { target: { value: '1000' } });

    expect(screen.queryByTestId('savings-amount-error')).not.toBeNull();
    expect(screen.getByTestId<HTMLButtonElement>('position-supply').disabled).toBe(true);
  });

  it('enables the CTA for a valid amount within balance', () => {
    renderSupply();
    fireEvent.change(screen.getByTestId('savings-amount-input'), { target: { value: '5' } });

    expect(screen.queryByTestId('savings-amount-error')).toBeNull();
    expect(screen.getByTestId<HTMLButtonElement>('position-supply').disabled).toBe(false);
  });

  it('offers USDS and DAI origin options on mainnet supply', () => {
    renderSupply();
    expect(screen.queryByTestId('origin-opt-USDS')).not.toBeNull();
    expect(screen.queryByTestId('origin-opt-DAI')).not.toBeNull();
  });

  it('routes useSavingsLaunch to the DAI origin token when DAI is selected', () => {
    renderSupply();
    fireEvent.click(screen.getByTestId('origin-opt-DAI'));
    expect(h.launchParams?.originToken?.symbol).toBe('DAI');
  });

  it('resets the amount when the origin token is switched', () => {
    renderSupply();
    fireEvent.change(screen.getByTestId('savings-amount-input'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('origin-opt-DAI'));
    expect(screen.getByTestId<HTMLInputElement>('savings-amount-input').value).toBe('');
  });
});
