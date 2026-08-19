import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

i18n.load('en', {});
i18n.activate('en');

const TEST_ADDRESS = '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' as const;

const h = vi.hoisted(() => ({ chainId: 1, connected: true }));

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useChainId: () => h.chainId,
    useConnection: () => ({ address: TEST_ADDRESS, isConnected: h.connected, isConnecting: false })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useOverallSkyData: () => ({ data: { skySavingsRatecRate: '0.0375' } }),
    useTokenBalances: () => ({
      data: [
        { symbol: 'USDS', formatted: '20000', value: 0n, decimals: 18, chainId: 1 },
        { symbol: 'DAI', formatted: '10000', value: 0n, decimals: 18, chainId: 1 }
      ],
      isLoading: false
    })
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

vi.mock('@/modules/ui/context/ConnectedContext', async importOriginal => {
  const actual = await importOriginal<typeof import('@/modules/ui/context/ConnectedContext')>();
  return {
    ...actual,
    useConnectedContext: () => ({ isConnectedAndAcceptedTerms: h.connected })
  };
});

vi.mock('@/modules/ui/components/ConnectModal', () => ({
  ConnectModal: () => <div data-testid="connect-modal-stub" />
}));

import { AnalyticsFlowProvider } from '@/modules/analytics/context/AnalyticsFlowContext';
import { ConnectModalProvider } from '@/modules/ui/context/ConnectModalContext';
import { ConnectThenActProvider, CONTINUATION_DELAY_MS } from '@/modules/ui/context/ConnectThenActContext';
import { SavingsSupplyCard } from './SavingsSupplyCard';

const wrap = (onSupply: () => void) => (
  <I18nProvider i18n={i18n}>
    <AnalyticsFlowProvider>
      <ConnectModalProvider>
        <ConnectThenActProvider>
          <SavingsSupplyCard onSupply={onSupply} />
        </ConnectThenActProvider>
      </ConnectModalProvider>
    </AnalyticsFlowProvider>
  </I18nProvider>
);

const renderCard = (onSupply = vi.fn()) => {
  render(wrap(onSupply));
  return onSupply;
};

describe('SavingsSupplyCard — no-position entry card', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    h.chainId = 1;
    h.connected = true;
  });

  it('renders the rate, aggregated idle balance, and the chain-aware supply tokens', () => {
    renderCard();

    expect(screen.getByTestId('savings-supply-card')).toBeTruthy();
    // Current rate from useOverallSkyData (decimal fraction → percentage).
    expect(screen.getAllByText('3.75%').length).toBeGreaterThan(0);
    // Idle balance = sum of the supply origins' wallet balances (20k + 10k).
    expect(screen.getByText('30,000')).toBeTruthy();
    // Mainnet supply origins are USDS + DAI (no inline input, just labels).
    expect(screen.getAllByText('USDS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DAI').length).toBeGreaterThan(0);
    // No inline amount input — entry happens in the modal.
    expect(screen.queryByTestId('savings-amount-input')).toBeNull();
  });

  // M6.3: both comps carry a product badge above the headline (desktop
  // 486:20522 reads "Sky Savings"; the mobile comp's "Sky Staking Engine"
  // wording looks like a design copy error — that engine belongs to Stake).
  it('renders the product badge above the headline', () => {
    renderCard();

    expect(screen.getByTestId('savings-supply-badge').textContent).toContain('Sky Savings');
  });

  it('opens the supply modal via onSupply when the CTA is clicked', () => {
    const onSupply = renderCard();

    fireEvent.click(screen.getByTestId('savings-supply-cta'));

    expect(onSupply).toHaveBeenCalledTimes(1);
  });

  it('keeps the CTA enabled while disconnected and routes the click into the connect flow', () => {
    vi.useFakeTimers();
    h.connected = false;
    const onSupply = vi.fn();
    const view = render(wrap(onSupply));

    // Idle balance still dashes without a wallet, but the CTA is live.
    expect(screen.getByText('–')).toBeTruthy();
    expect((screen.getByTestId('savings-supply-cta') as HTMLButtonElement).disabled).toBe(false);

    // Clicking opens the connect modal instead of the supply modal…
    fireEvent.click(screen.getByTestId('savings-supply-cta'));
    expect(onSupply).not.toHaveBeenCalled();
    expect(screen.getByTestId('connect-modal-stub')).toBeTruthy();

    // …and once connected (past the terms gate), the supply flow continues
    // after the anti-flash pause.
    h.connected = true;
    view.rerender(wrap(onSupply));
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS));
    expect(onSupply).toHaveBeenCalledTimes(1);
  });
});
