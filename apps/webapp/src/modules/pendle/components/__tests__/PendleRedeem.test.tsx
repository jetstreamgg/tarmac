/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'viem/chains';
import type { PendleConvertQuote } from '@/hooks';

i18n.load('en', {});
i18n.activate('en');

const MARKET: import('@/hooks').PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as `0x${string}`,
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548' as `0x${string}`,
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1' as `0x${string}`,
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927' as `0x${string}`,
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d' as `0x${string}`,
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1700000000
};

const USDG_TOKEN = {
  name: 'USDG',
  symbol: 'USDG',
  decimals: 6,
  color: '#00C2A1',
  address: { [mainnet.id]: MARKET.underlyingToken }
};

const USDS_TOKEN = {
  name: 'USDS',
  symbol: 'USDS',
  decimals: 18,
  color: '#000000',
  address: { [mainnet.id]: '0xdc035d45d973e3ec169d2276ddab16f1e407384f' as `0x${string}` }
};

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1
  };
});

vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return {
    ...actual,
    useTokenImage: () => '',
    useChainImage: () => ''
  };
});

vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

import { PendleRedeem } from '../PendleRedeem';

const baseQuote: PendleConvertQuote = {
  method: 'redeemPyToToken',
  amountOut: 1_480_000n, // 1.48 USDG (6 decimals)
  apiMinOut: 1_465_200n,
  effectiveApy: 0,
  impliedApy: 0,
  priceImpact: -0.0005,
  fetchedAt: Date.now(),
  apiContractParams: [],
  apiContractParamsName: []
};

const baseProps = {
  market: MARKET,
  ptBalance: 1_500_000n, // 1.5 PT-USDG (6 decimals)
  outputTokenList: [USDG_TOKEN, USDS_TOKEN],
  selectedOutputToken: USDG_TOKEN,
  onOutputTokenChange: () => undefined,
  quote: undefined as PendleConvertQuote | undefined,
  isFetchingQuote: false,
  slippageDisplay: '1%',
  slippageMode: 'Auto',
  network: 'Ethereum',
  networkChainId: 1
};

const renderRedeem = (props: Partial<typeof baseProps> = {}) =>
  render(
    <I18nProvider i18n={i18n}>
      <PendleRedeem {...baseProps} {...props} />
    </I18nProvider>
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PendleRedeem', () => {
  it('labels the hero as the payout, not a claim — "claim" names the PT side in the comps', () => {
    renderRedeem({ quote: baseQuote });

    const hero = screen.getByTestId('pendle-redeem-hero');
    expect(hero.textContent).toContain("You'll receive");
    expect(hero.textContent).not.toContain("You'll claim");
    // The PT side keeps the claim vocabulary.
    expect(screen.getByTestId('pendle-redeem-row-Claim amount')).toBeTruthy();
  });

  it('draws the receive hero from the quote, a dash before one arrives', () => {
    const { rerender } = renderRedeem();
    expect(screen.getByTestId('pendle-redeem-hero').textContent).toContain('–');

    rerender(
      <I18nProvider i18n={i18n}>
        <PendleRedeem {...baseProps} quote={baseQuote} />
      </I18nProvider>
    );
    expect(screen.getByTestId('pendle-redeem-hero').textContent).toContain('1.48');
    expect(screen.getByTestId('pendle-redeem-hero').textContent).toContain('USDG');
  });

  it('shows the product and the full PT balance as the claim amount', () => {
    renderRedeem({ quote: baseQuote });

    expect(screen.getByTestId('pendle-redeem-row-Product').textContent).toContain('Pendle USDG (PT-USDG)');
    expect(screen.getByTestId('pendle-redeem-row-Claim amount').textContent).toContain('1.5');
  });

  it('hosts the payout-token selector on the hero pill, not in the read-only grid', () => {
    renderRedeem();

    const hero = screen.getByTestId('pendle-redeem-hero');
    expect(hero.querySelector('[data-testid="pendle-redeem-output-token"]')).toBeTruthy();
    expect(screen.queryByTestId('pendle-redeem-row-Claim token')).toBeNull();
  });

  it('keeps slippage and its floor on a pure redemption — the signed minTokenOut binds there too', () => {
    renderRedeem({ quote: baseQuote });

    expect(screen.getByTestId('pendle-redeem-row-Slippage').textContent).toContain('1%');
    expect(screen.getByTestId('pendle-redeem-row-Min. received')).toBeTruthy();
    // Only the per-hop route cells are aggregator-only.
    expect(screen.queryByTestId('pendle-redeem-row-Price impact')).toBeNull();
    expect(screen.queryByTestId('pendle-redeem-row-Routed via')).toBeNull();
    expect(screen.getByTestId('pendle-redeem-row-Pendle fee').textContent).toContain('Included in quote');
    expect(screen.getByTestId('pendle-redeem-row-Network fee')).toBeTruthy();
  });

  it('draws slippage, min received and sign-flipped price impact on aggregator routes', () => {
    renderRedeem({ quote: { ...baseQuote, aggregatorType: 'kyberswap' } });

    expect(screen.getByTestId('pendle-redeem-row-Slippage').textContent).toContain('1%');
    // apiMinOut 1.4652 USDG floors to 1.46 — the figure is a contractual
    // minimum, so half-up rounding would overstate the guarantee.
    expect(screen.getByTestId('pendle-redeem-row-Min. received').textContent).toContain('1.46');
    // Raw -0.0005 displays positive (a cost) under the inverse convention.
    expect(screen.getByTestId('pendle-redeem-row-Price impact').textContent).toContain('0.050%');
  });

  it('formats the Pendle fee in dollars when the quote carries one', () => {
    renderRedeem({ quote: { ...baseQuote, feeUsd: 0.0363 } });
    expect(screen.getByTestId('pendle-redeem-row-Pendle fee').textContent).toContain('$0.0363');

    cleanup();
    renderRedeem({ quote: { ...baseQuote, feeUsd: 12.345 } });
    expect(screen.getByTestId('pendle-redeem-row-Pendle fee').textContent).toContain('$12.35');
  });

  it('names the network in the Network cell', () => {
    renderRedeem();
    expect(screen.getByTestId('pendle-redeem-row-Network').textContent).toContain('Ethereum');
  });

  it('names the aggregator route in the Routed via cell', () => {
    renderRedeem({ quote: { ...baseQuote, aggregatorType: 'kyberswap' } });
    expect(screen.getByTestId('pendle-redeem-row-Routed via').textContent).toContain('Pendle redeem →');
  });

  it('keeps the slippage gear reachable before a quote resolves on a non-SY output', () => {
    // USDS is outside the market's SY-accepted list here, so the route will
    // need an aggregator — the gear must exist even while no quote has landed
    // (a too-tight tolerance can be the reason it doesn't).
    renderRedeem({
      market: { ...MARKET, syAcceptedTokens: [MARKET.underlyingToken] },
      selectedOutputToken: USDS_TOKEN,
      quote: undefined
    });
    expect(screen.getByTestId('pendle-redeem-row-Slippage')).toBeTruthy();
  });

  it('holds skeletons (not dashes) while the quote is in flight', () => {
    renderRedeem({
      market: { ...MARKET, syAcceptedTokens: [MARKET.underlyingToken] },
      selectedOutputToken: USDS_TOKEN,
      quote: undefined,
      isFetchingQuote: true
    });
    expect(screen.getByTestId('hero-loading')).toBeTruthy();
    expect(
      screen.getByTestId('pendle-redeem-row-Min. received').querySelector('[data-testid="cell-loading"]')
    ).toBeTruthy();
  });

  it('formats the output legs in the selected token decimals (18d), the claim amount in PT decimals (6d)', () => {
    // Guards the 6-vs-18 mixup: reusing the PT decimals for an 18-decimal
    // output would print a trillions-scale number.
    renderRedeem({
      selectedOutputToken: USDS_TOKEN,
      quote: {
        ...baseQuote,
        amountOut: 1_499_500_000_000_000_000n, // 1.4995 USDS (18 decimals)
        apiMinOut: 1_450_000_000_000_000_000n,
        aggregatorType: 'kyberswap'
      }
    });
    const hero = screen.getByTestId('pendle-redeem-hero').textContent!;
    expect(hero).toContain('1.5');
    expect(hero).toContain('USDS');
    expect(hero).not.toContain('PT-USDG');
    expect(hero).not.toContain(',');
    expect(screen.getByTestId('pendle-redeem-row-Min. received').textContent).toContain('1.45');
    expect(screen.getByTestId('pendle-redeem-row-Claim amount').textContent).toContain('1.5');
  });
});
