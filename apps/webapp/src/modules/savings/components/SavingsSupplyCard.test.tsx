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
import { MAINNET_SUPPLY_ORIGINS, L2_SUPPLY_ORIGINS } from './SavingsOriginSelect';

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

  it('renders the rate and aggregated idle balance', () => {
    renderCard();

    expect(screen.getByTestId('savings-supply-card')).toBeTruthy();
    // Current rate from useOverallSkyData (decimal fraction → percentage).
    expect(screen.getAllByText('3.75%').length).toBeGreaterThan(0);
    // Idle balance = sum of the supply origins' wallet balances (20k + 10k).
    expect(screen.getByText('30,000')).toBeTruthy();
    // No inline amount input — entry happens in the modal.
    expect(screen.queryByTestId('savings-amount-input')).toBeNull();
  });

  // Figma Annotations R2 F3: mainnet's 3 supply origins (USDS/DAI/USDC) trip
  // the 3+ edge case — the enumerated per-token icons+symbols drop in favor
  // of generic "stablecoins" copy.
  it('falls back to generic "stablecoins" copy with no per-token symbols at 3+ origins (mainnet)', () => {
    renderCard();

    expect(screen.getByText('Supply stablecoins and earn 3.75% APY')).toBeTruthy();
    // TokenIcon is mocked to null, so the enumerated span (icon + symbol per
    // origin) is only observable via its symbol text — absent here confirms
    // the whole enumerated tree, icons included, isn't mounted on this path.
    expect(screen.queryByText('USDS')).toBeNull();
    expect(screen.queryByText('DAI')).toBeNull();
    expect(screen.queryByText('USDC')).toBeNull();
  });

  // The ≤2-origin path (L2: USDS/USDC) keeps the original enumerated form.
  it('keeps the enumerated icons+symbols form at 2 origins (L2)', () => {
    h.chainId = 8453; // Base
    renderCard();

    expect(screen.getByText(/at 3\.75% APY/)).toBeTruthy();
    expect(screen.getAllByText('USDS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(0);
    // DAI isn't an L2 supply origin — confirms the enumeration is chain-aware,
    // not just "every symbol the card knows about".
    expect(screen.queryByText('DAI')).toBeNull();
    // The generic 3+ copy must not leak into the 2-origin path.
    expect(screen.queryByText(/Supply stablecoins/)).toBeNull();
  });

  // Branch-boundary pin: the 3+ edge case in SavingsSupplyCard is keyed off
  // `origins.length >= 3`. If MAINNET_SUPPLY_ORIGINS ever drops back to 2 (or
  // L2_SUPPLY_ORIGINS grows to 3), the card's copy silently flips — this
  // fails loudly instead, independent of the rendering assertions above.
  it('pins the origin counts the generic-copy branch boundary depends on', () => {
    expect(MAINNET_SUPPLY_ORIGINS.length).toBe(3);
    expect(L2_SUPPLY_ORIGINS.length).toBe(2);
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
