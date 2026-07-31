import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

const h = vi.hoisted(() => ({
  chainId: 1 as number,
  walletBalance: 0n as bigint,
  // L2 PSM mocks: the sUSDS→token converted balance (withdraw source) and the
  // sUSDS-in ceiling for a specific withdraw, plus the supply slippage floor.
  convertedValue: 0n as bigint,
  maxAmountIn: 0n as bigint,
  minAmountOut: 0n as bigint,
  prepared: true,
  execute: vi.fn(),
  update: vi.fn(),
  // Latest params the form passed to useSavingsLaunch (flow / max / amount / origin +
  // the L2 PSM bounds, so the L2 routing can be asserted).
  launchParams: undefined as
    | {
        flow?: string;
        max?: boolean;
        amount?: bigint;
        originToken?: { symbol?: string };
        minAmountOut?: bigint;
        sUsdsBalance?: bigint;
        minAmountOutForWithdrawAll?: bigint;
        maxAmountInForWithdraw?: bigint;
      }
    | undefined
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => h.chainId,
    useChains: () => [
      { id: 1, name: 'Ethereum' },
      { id: 8453, name: 'Base' }
    ],
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: true, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    // The bundling badge asks whether the wallet can batch; these renders have no
    // WagmiProvider, so answer "no" and the fee row stays a plain value.
    useIsBatchSupported: () => ({
      data: false,
      isLoading: false,
      error: null,
      mutate: () => {},
      dataSources: []
    }),
    useNetworkFee: () => ({
      data: undefined,
      isLoading: false,
      error: null,
      mutate: () => {},
      dataSources: []
    }),
    // The savings position (drives the withdraw balance/Max).
    useSavingsData: () => ({
      data: { userSavingsBalance: 100n * 10n ** 18n, savingsRate: 65n * 10n ** 15n, savingsTvl: 0n },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
      dataSources: []
    }),
    // Canonical Sky Savings Rate (skySavingsRatecRate) — the "Savings rate" row source.
    useOverallSkyData: () => ({ data: { skySavingsRatecRate: '0.0375' } }),
    useTokenBalance: () => ({ data: { value: h.walletBalance }, refetch: vi.fn() }),
    // Mainnet-supply sUSDS preview — gated off in the modal (enablePreview=false), so
    // it stays disabled here; stubbed only to keep the read out of real wagmi.
    useReadSavingsUsds: () => ({ data: undefined }),
    // L2 PSM preview reads — stubbed (real ones need a wagmi read provider).
    usePreviewSwapExactIn: () => ({ value: h.convertedValue }),
    usePreviewSwapExactOut: () => ({ value: h.maxAmountIn })
  };
});

// L2 PSM supply slippage floor — stubbed (the real hook reads the SSR auth oracle).
vi.mock('../hooks/useSavingsSupplyMinAmountOut', () => ({
  useSavingsSupplyMinAmountOut: () => h.minAmountOut
}));

// The engine seam — stubbed so the form mounts without real wagmi writes. Records
// the params so the withdraw flow + Max → max flag + L2 bound wiring can be asserted.
vi.mock('../hooks/useSavingsLaunch', () => ({
  useSavingsLaunch: (params: {
    flow: string;
    max?: boolean;
    amount: bigint;
    originToken?: { symbol?: string };
    minAmountOut?: bigint;
    sUsdsBalance?: bigint;
    minAmountOutForWithdrawAll?: bigint;
    maxAmountInForWithdraw?: bigint;
  }) => {
    h.launchParams = params;
    return {
      launch: vi.fn(),
      execute: h.execute,
      steps: ['Supply'],
      prepared: h.prepared,
      isLoading: false,
      error: null,
      // Mirrors the real result shape; the form reads these for the fee row's
      // bundling badge and the "Save X%" promo.
      calls: [],
      isBatch: false
    };
  }
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  // txStatus stays IDLE: these tests exercise the live entry pushes, which the
  // shared hook freezes once a tx is in flight.
  useTransaction: () => ({ updateModalContent: h.update, txStatus: 'idle' }),
  // No entry slot in these standalone renders → the form renders its body inline.
  useEntrySlot: () => null
}));

// Stub the origin dropdown as plain option buttons (Radix Select interaction is
// fragile in happy-dom); the real origin constants are preserved so the form still
// maps the picked symbol → Token and routes DAI to the upgrade-and-supply path.
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

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { SavingsModalForm } from './SavingsModalForm';
import type { SavingsLaunchFlow } from '../hooks/useSavingsLaunch';
import { TooltipProvider } from '@/components/ui/tooltip';

const renderForm = (flow: SavingsLaunchFlow) =>
  render(
    <I18nProvider i18n={i18n}>
      <TooltipProvider>
        <SavingsModalForm sessionId="s1" flow={flow} />
      </TooltipProvider>
    </I18nProvider>
  );

// The last entry.confirmDisabled pushed to the modal.
const lastDisabled = () => {
  const withEntry = h.update.mock.calls.filter(([, patch]) => patch?.entry?.confirmDisabled !== undefined);
  return withEntry.at(-1)?.[1].entry.confirmDisabled;
};

// The last minimized-toast titles pushed to the modal.
const lastToast = () => {
  const withToast = h.update.mock.calls.filter(([, patch]) => patch?.toast !== undefined);
  return withToast.at(-1)?.[1].toast;
};

const FIGMA_ROWS = ['Savings rate', 'Network', 'Supply', 'Est. earnings (1Y)', 'Network fee'];

describe('SavingsModalForm — Supply to Sky Savings entry body', () => {
  beforeEach(() => {
    h.chainId = 1;
    h.walletBalance = 100n * 10n ** 18n;
    h.convertedValue = 0n;
    h.maxAmountIn = 0n;
    h.minAmountOut = 0n;
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

  it('pushes an amount-aware success title for the minimized toast', () => {
    renderForm('supply');
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '10000' } });
    expect(lastToast()?.success).toBe('10,000 USDS supplied!');
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

  it('offers USDS and DAI origin options on mainnet supply', () => {
    renderForm('supply');
    expect(screen.queryByTestId('origin-opt-USDS')).not.toBeNull();
    expect(screen.queryByTestId('origin-opt-DAI')).not.toBeNull();
  });

  it('routes the supply to the DAI origin token (upgrade-and-supply) when DAI is selected', () => {
    renderForm('supply');
    fireEvent.click(screen.getByTestId('origin-opt-DAI'));
    expect(h.launchParams?.originToken?.symbol).toBe('DAI');
  });

  it('resets the amount when the origin token is switched', () => {
    renderForm('supply');
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '5' } });
    fireEvent.click(screen.getByTestId('origin-opt-DAI'));
    expect((screen.getByTestId('savings-modal-amount-input') as HTMLInputElement).value).toBe('');
  });
});

describe('SavingsModalForm — Withdraw from Sky Savings entry body', () => {
  beforeEach(() => {
    h.chainId = 1;
    // A small wallet balance proves withdraw caps on the position, not the wallet.
    h.walletBalance = 1n * 10n ** 18n;
    h.convertedValue = 0n;
    h.maxAmountIn = 0n;
    h.minAmountOut = 0n;
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

  it('shows only a USDS origin option on mainnet withdraw (no DAI)', () => {
    renderForm('withdraw');
    expect(screen.queryByTestId('origin-opt-USDS')).not.toBeNull();
    expect(screen.queryByTestId('origin-opt-DAI')).toBeNull();
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

describe('SavingsModalForm — L2 PSM (Base) supply/withdraw', () => {
  beforeEach(() => {
    h.chainId = 8453; // Base
    h.walletBalance = 100n * 10n ** 18n;
    // The whole sUSDS balance valued in the destination token: 200 (USDS-equivalent,
    // the default USDS destination is 18-dec). Proves withdraw caps on the converted
    // balance, not the 100-USDS position.
    h.convertedValue = 200n * 10n ** 18n;
    h.maxAmountIn = 7n * 10n ** 18n; // sUSDS-in ceiling for a specific withdraw
    h.minAmountOut = 49n * 10n ** 17n; // 4.9 sUSDS slippage floor
    h.prepared = true;
    h.execute.mockClear();
    h.update.mockClear();
    h.launchParams = undefined;
  });
  afterEach(() => cleanup());

  it('offers USDS and USDC supply origins (no DAI) on L2', () => {
    renderForm('supply');
    expect(screen.queryByTestId('origin-opt-USDS')).not.toBeNull();
    expect(screen.queryByTestId('origin-opt-USDC')).not.toBeNull();
    expect(screen.queryByTestId('origin-opt-DAI')).toBeNull();
  });

  it('routes the supply to the USDC origin token (PSM) when USDC is selected', () => {
    renderForm('supply');
    fireEvent.click(screen.getByTestId('origin-opt-USDC'));
    expect(h.launchParams?.originToken?.symbol).toBe('USDC');
  });

  it('surfaces the sUSDS slippage floor ("Receive at least") once an amount is entered', () => {
    renderForm('supply');
    expect(screen.queryByTestId('savings-modal-row-Receive at least')).toBeNull();
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '5' } });
    expect(screen.queryByTestId('savings-modal-row-Receive at least')).not.toBeNull();
  });

  it('passes the min sUSDS out (slippage floor) to useSavingsLaunch on L2 supply', () => {
    renderForm('supply');
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '5' } });
    expect(h.launchParams?.minAmountOut).toBe(h.minAmountOut);
  });

  it('offers a USDS / USDC withdraw destination choice on L2', () => {
    renderForm('withdraw');
    expect(screen.queryByTestId('origin-opt-USDS')).not.toBeNull();
    expect(screen.queryByTestId('origin-opt-USDC')).not.toBeNull();
  });

  it('caps the L2 withdraw on the converted (sUSDS→token) balance, not the position', () => {
    renderForm('withdraw');
    // 150 > the 100-USDS position but < the 200 converted balance → valid, proving
    // the L2 withdraw is bounded by the swap-out balance, not the position.
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '150' } });
    expect(lastDisabled()).toBe(false);
    expect(screen.queryByTestId('savings-modal-amount-error')).toBeNull();
  });

  it('Max swaps the whole sUSDS balance out (max flag + sUsdsBalance passed)', () => {
    renderForm('withdraw');
    fireEvent.click(screen.getByTestId('savings-modal-amount-max'));
    expect(h.launchParams?.max).toBe(true);
    // The whole sUSDS balance is handed to the engine for swapExactIn (no dust).
    expect(h.launchParams?.sUsdsBalance).toBe(h.walletBalance);
    expect(lastDisabled()).toBe(false);
  });

  it('caps a specific L2 withdraw via the sUSDS-in ceiling (swapExactOut)', () => {
    renderForm('withdraw');
    fireEvent.change(screen.getByTestId('savings-modal-amount-input'), { target: { value: '50' } });
    expect(h.launchParams?.max).toBe(false);
    expect(h.launchParams?.maxAmountInForWithdraw).toBe(h.maxAmountIn);
  });
});
