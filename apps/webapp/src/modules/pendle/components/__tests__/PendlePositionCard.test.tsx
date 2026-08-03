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
  walletBalance: 0n as bigint
}));

const openSupply = vi.fn();
const openWithdraw = vi.fn();

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
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
      data: { [MARKET.marketAddress]: { impliedApy: 0.0486 } },
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    useTokenBalance: () => ({ data: { value: h.walletBalance }, isLoading: false })
  };
});

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

import { ConnectModalProvider } from '@/modules/ui/context/ConnectModalContext';
import { ConnectThenActProvider, CONTINUATION_DELAY_MS } from '@/modules/ui/context/ConnectThenActContext';
import { PendlePositionCard } from '../PendlePositionCard';

const wrap = () => (
  <I18nProvider i18n={i18n}>
    <ConnectModalProvider>
      <ConnectThenActProvider>
        <PendlePositionCard market={MARKET} />
      </ConnectThenActProvider>
    </ConnectModalProvider>
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
});
