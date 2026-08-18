import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const h = vi.hoisted(() => ({
  launch: vi.fn(),
  form: {
    direction: 'USDS_TO_USDC',
    originSymbol: 'USDS',
    targetSymbol: 'USDC',
    value: '',
    targetValue: '',
    amount: 0n,
    targetAmount: 0n,
    originDecimals: 18,
    targetDecimals: 6,
    originBalance: 0n,
    targetBalance: 0n,
    isConnected: true,
    isZero: true,
    insufficient: false,
    onInput: vi.fn(),
    flip: vi.fn(),
    selectToken: vi.fn(),
    setPercent: vi.fn(),
    mutateBalances: vi.fn(),
    reset: vi.fn()
  },
  conversion: {
    disabledReason: undefined as string | undefined,
    targetToken: { symbol: 'USDC' }
  }
}));

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});

// ConvertPage now reads the chain and emits app_convert_blocked (APP-444 H).
vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: undefined }),
    useChains: () => [{ id: 1, name: 'Ethereum' }]
  };
});

vi.mock('../hooks/useConvertForm', () => ({
  useConvertForm: () => h.form
}));

vi.mock('../hooks/useConvertLaunch', () => ({
  useConvertLaunch: () => ({ launch: h.launch, conversion: h.conversion, steps: [] })
}));

// Connect-then-act passes the action through when connected (the real provider
// needs the whole wallet stack); the pass-through keeps the CTA seam observable.
vi.mock('@/modules/ui/context/ConnectThenActContext', () => ({
  useConnectThenAct: (action: () => void) => action
}));

// The card pulls in ChainModal → the full wagmi/network stack; the page test
// only asserts composition around it.
vi.mock('./ConvertCard', () => ({
  ConvertCard: () => <div data-testid="convert-card" />
}));

import { ConvertPage } from './ConvertPage';
import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';

const renderPage = () =>
  render(
    <I18nProvider i18n={i18n}>
      <AnalyticsFlowProvider>
        <ConvertPage />
      </AnalyticsFlowProvider>
    </I18nProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.form.isZero = true;
  h.form.insufficient = false;
  h.form.isConnected = true;
  h.conversion.disabledReason = undefined;
});

afterEach(cleanup);

describe('ConvertPage', () => {
  it('renders the Figma hero (badges, title, subtitle) and the card', () => {
    renderPage();
    expect(screen.getByText('Convert stablecoins')).toBeTruthy();
    expect(screen.getByText('1:1 Exchange rate')).toBeTruthy();
    expect(screen.getByText('$0.00 Fees paid')).toBeTruthy();
    expect(screen.getByTestId('convert-card')).toBeTruthy();
  });

  it('disables Review until an amount is entered, then launches the modal', () => {
    renderPage();
    const cta = screen.getByTestId('convert-review-cta') as HTMLButtonElement;
    expect(cta.disabled).toBe(true);

    h.form.isZero = false;
    cleanup();
    renderPage();
    const enabled = screen.getByTestId('convert-review-cta') as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);
    fireEvent.click(enabled);
    expect(h.launch).toHaveBeenCalledTimes(1);
  });

  it('shows insufficient funds over the engine guard and disables Review', () => {
    h.form.isZero = false;
    h.form.insufficient = true;
    h.conversion.disabledReason = 'insufficient_liquidity';
    renderPage();

    expect(screen.getByTestId('convert-error').textContent).toBe('Insufficient funds');
    expect((screen.getByTestId('convert-review-cta') as HTMLButtonElement).disabled).toBe(true);
  });

  it('surfaces engine guard reasons (e.g. liquidity) as the error line', () => {
    h.form.isZero = false;
    h.conversion.disabledReason = 'insufficient_liquidity';
    renderPage();

    expect(screen.getByTestId('convert-error').textContent).toBe('Insufficient USDC liquidity');
  });

  it('keeps Review clickable when disconnected (connect-then-act takes over)', () => {
    h.form.isConnected = false;
    renderPage();
    expect((screen.getByTestId('convert-review-cta') as HTMLButtonElement).disabled).toBe(false);
  });
});
