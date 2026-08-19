/// <reference types="vite/client" />

import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'viem/chains';
import type { PendleConvertQuote } from '@/hooks';

i18n.load('en', {});
i18n.activate('en');

const MARKET = {
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
  slippage: 0.01,
  slippageMode: 'Auto',
  network: 'Ethereum',
  networkChainId: 1
};

const renderRedeem = (props: Partial<typeof baseProps> & { prepareErrorMessage?: string } = {}) =>
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

  it('hosts the output-token selector in the Claim token cell', () => {
    renderRedeem();

    const cell = screen.getByTestId('pendle-redeem-row-Claim token');
    expect(cell.querySelector('[data-testid="pendle-redeem-output-token"]')).toBeTruthy();
  });

  it('omits the swap-math cells on a pure redemption (no aggregator route)', () => {
    renderRedeem({ quote: baseQuote });

    expect(screen.queryByTestId('pendle-redeem-row-Slippage')).toBeNull();
    expect(screen.queryByTestId('pendle-redeem-row-Min. received')).toBeNull();
    expect(screen.queryByTestId('pendle-redeem-row-Price impact')).toBeNull();
    expect(screen.getByTestId('pendle-redeem-row-Pendle fee').textContent).toContain('Included in quote');
    expect(screen.getByTestId('pendle-redeem-row-Network fee')).toBeTruthy();
  });

  it('draws slippage, min received and sign-flipped price impact on aggregator routes', () => {
    renderRedeem({ quote: { ...baseQuote, aggregatorType: 'kyberswap' } });

    expect(screen.getByTestId('pendle-redeem-row-Slippage').textContent).toContain('1%');
    // apiMinOut 1.4652 USDG rounds to 1.47 at two decimals.
    expect(screen.getByTestId('pendle-redeem-row-Min. received').textContent).toContain('1.47');
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

  it('renders the inline prepare-error banner only when a message is set', () => {
    renderRedeem({ prepareErrorMessage: 'Quote expired' });
    expect(screen.getByTestId('pendle-redeem-prepare-error').textContent).toBe('Quote expired');

    cleanup();
    renderRedeem();
    expect(screen.queryByTestId('pendle-redeem-prepare-error')).toBeNull();
  });

  it('names the network in the Network cell', () => {
    renderRedeem();
    expect(screen.getByTestId('pendle-redeem-row-Network').textContent).toContain('Ethereum');
  });
});
