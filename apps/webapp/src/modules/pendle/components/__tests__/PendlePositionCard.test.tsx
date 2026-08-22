import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PendleMarketConfig } from '@/hooks/pendle/pendle';

i18n.load('en', {});
i18n.activate('en');

const MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548',
  ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1',
  syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927',
  underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 18,
  expiry: 1795651200, // 26 Nov 2026
  usdsEquivalence: 'pegged'
};

const h = vi.hoisted(() => ({
  connected: true,
  ptBalance: 0n as bigint,
  walletBalance: 0n as bigint,
  // Overrides the market's own expiry (the card prefers the API's) — a past
  // value is how these specs reach the matured state.
  expirySec: undefined as number | undefined,
  earnings: { earnings: 184.8 as number | undefined, currency: 'USDS' as string | undefined }
}));

const openSupply = vi.fn();
const openWithdraw = vi.fn();
const openRedeemModal = vi.fn();

vi.mock('posthog-js/react', async () => {
  const posthog = (await import('posthog-js')).default;
  return { usePostHog: () => posthog };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useChainId: () => 1,
    useConnection: () => ({
      address: h.connected ? '0x000000000000000000000000000000000000beef' : undefined,
      isConnected: h.connected
    })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    usePendleUserPtBalances: () => ({
      data: { [MARKET.marketAddress]: h.ptBalance },
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    usePendleMarketsApiData: () => ({
      data: { [MARKET.marketAddress]: { impliedApy: 0.0486, expirySec: h.expirySec } },
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    useTokenBalance: () => ({ data: { value: h.walletBalance }, isLoading: false }),
    usePendleRedeemPreview: () => ({ data: undefined, isLoading: false }),
    usePendleMaturedPositionEarnings: () => h.earnings
  };
});

vi.mock('../../hooks/usePendleRedeemModal', () => ({
  usePendleRedeemModal: () => ({ openRedeemModal, isRedeemable: true, isPrepared: true, ptBalance: 0n })
}));

// The mainnet auto-switch pulls navigation/network-switch contexts — covered
// by usePendleMaturedPositions.test.
vi.mock('../../hooks/usePendleMaturedPositions', () => ({
  usePendleMaturedNetworkSwitch: () => undefined
}));

vi.mock('../../hooks/usePendleModal', () => ({
  usePendleModal: () => ({ openSupply, openWithdraw })
}));

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
import { PendlePositionCard } from '../PendlePositionCard';

const wrap = () => (
  <I18nProvider i18n={i18n}>
    <AnalyticsFlowProvider>
      <ConnectModalProvider>
        <ConnectThenActProvider>
          <PendlePositionCard market={MARKET} />
        </ConnectThenActProvider>
      </ConnectModalProvider>
    </AnalyticsFlowProvider>
  </I18nProvider>
);

const renderCard = () => render(wrap());

describe('PendlePositionCard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.useRealTimers();
    h.connected = true;
    h.ptBalance = 0n;
    h.walletBalance = 0n;
    h.expirySec = undefined;
    h.earnings = { earnings: 184.8, currency: 'USDS' };
  });

  it('shows the supply CTA card with the current rate when the user has no position', () => {
    h.walletBalance = 30_000n * 10n ** 18n;
    renderCard();

    const card = screen.getByTestId('pendle-supply-card');
    expect(card.textContent).toContain('4.86%');
    expect(card.textContent).toContain('30,000');
    expect(screen.queryByTestId('pendle-position-card')).toBeNull();
  });

  it('opens the supply modal from the CTA', () => {
    renderCard();

    fireEvent.click(screen.getByTestId('pendle-supply-cta'));
    expect(openSupply).toHaveBeenCalledTimes(1);
  });

  it('keeps the CTA enabled while disconnected and routes the click into the connect flow', () => {
    vi.useFakeTimers();
    h.connected = false;
    const view = renderCard();

    expect((screen.getByTestId('pendle-supply-cta') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId('pendle-supply-cta'));
    expect(openSupply).not.toHaveBeenCalled();
    expect(screen.getByTestId('connect-modal-stub')).toBeTruthy();

    h.connected = true;
    view.rerender(wrap());
    act(() => vi.advanceTimersByTime(CONTINUATION_DELAY_MS));
    expect(openSupply).toHaveBeenCalledTimes(1);
  });

  it('shows the position summary when the user holds PT', () => {
    h.ptBalance = 100_000n * 10n ** 18n;
    renderCard();

    const card = screen.getByTestId('pendle-position-card');
    expect(card.textContent).toContain('100,000'); // PT balance hero
    expect(card.textContent).toMatch(/2026/); // claim date
    expect(screen.queryByTestId('pendle-supply-card')).toBeNull();
  });

  it('opens the supply and withdraw modals from the position card', () => {
    h.ptBalance = 100_000n * 10n ** 18n;
    renderCard();

    fireEvent.click(screen.getByTestId('pendle-position-supply'));
    expect(openSupply).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('pendle-position-withdraw'));
    expect(openWithdraw).toHaveBeenCalledTimes(1);
  });

  describe('matured market', () => {
    const MATURED_SEC = 1_700_000_000; // 2023

    it('shows the claim card with the accrued figure and ready-to-withdraw copy', () => {
      h.expirySec = MATURED_SEC;
      h.ptBalance = 100_184n * 10n ** 18n;
      renderCard();

      const card = screen.getByTestId('pendle-matured-position-card');
      expect(card.textContent).toContain('100,184');
      expect(card.textContent).toContain('Accrued');
      expect(card.textContent).toContain('184.8');
      expect(card.textContent).toContain('ready to withdraw');
      // The active-position actions are gone — claiming is the only move.
      expect(screen.queryByTestId('pendle-position-supply')).toBeNull();
      expect(screen.queryByTestId('pendle-position-withdraw')).toBeNull();
    });

    it('opens the redeem modal from the Claim CTA', () => {
      h.expirySec = MATURED_SEC;
      h.ptBalance = 100_184n * 10n ** 18n;
      renderCard();

      fireEvent.click(screen.getByTestId('pendle-matured-redeem-button'));
      expect(openRedeemModal).toHaveBeenCalledTimes(1);
    });

    it('falls back to the deposit-only line when earnings are unavailable', () => {
      h.expirySec = MATURED_SEC;
      h.ptBalance = 100_184n * 10n ** 18n;
      h.earnings = { earnings: undefined, currency: undefined };
      renderCard();

      const card = screen.getByTestId('pendle-matured-position-card');
      expect(card.textContent).toContain('Your deposit is ready to withdraw');
      expect(card.textContent).not.toContain('in yield');
    });

    it('shows the closed-market state — never the supply pitch — when a connected user holds nothing', () => {
      h.expirySec = MATURED_SEC;
      h.ptBalance = 0n;
      renderCard();

      const card = screen.getByTestId('pendle-matured-closed-card');
      expect(card.textContent).toContain('This market has matured');
      expect(card.textContent).toContain('no longer accepts deposits');
      expect(card.textContent).not.toContain('Connect your wallet');
      // The page is reachable without a wallet now; a Supply CTA here would
      // open a modal that cannot quote against a matured market.
      expect(screen.queryByTestId('pendle-supply-card')).toBeNull();
      expect(screen.queryByTestId('pendle-supply-cta')).toBeNull();
      expect(screen.queryByTestId('pendle-matured-position-card')).toBeNull();
    });

    it('offers a way back to Earn from the closed-market state', () => {
      h.expirySec = MATURED_SEC;
      h.ptBalance = 0n;
      renderCard();

      expect(screen.getByTestId('pendle-matured-browse-cta')).toBeTruthy();
    });

    it('shows the same closed state while disconnected, plus a nudge to connect', () => {
      h.expirySec = MATURED_SEC;
      h.connected = false;
      h.ptBalance = 0n;
      renderCard();

      // A zero balance with no wallet means unknown, not empty — and every
      // in-app route to this page requires holding matured PT.
      const card = screen.getByTestId('pendle-matured-closed-card');
      expect(card.textContent).toContain('no longer accepts deposits');
      expect(card.textContent).toContain('Connect your wallet to check');
      expect(screen.queryByTestId('pendle-supply-cta')).toBeNull();
    });
  });
});
