/// <reference types="vite/client" />

import { act, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { mainnet } from 'viem/chains';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const MARKET = {
  name: 'PT-USDG',
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

vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return {
    ...actual,
    useTokenImage: () => '',
    useChainImage: () => '',
    // Stub heavy widget components to keep this a focused unit test.
    TokenDropdown: ({ token, dataTestId }: { token: { symbol: string }; dataTestId?: string }) => (
      <button data-testid={`${dataTestId}-menu-button`}>{token.symbol}</button>
    ),
    TransactionOverview: ({
      title,
      isFetching,
      fetchingMessage,
      pinnedData,
      transactionData
    }: {
      title: string;
      isFetching: boolean;
      fetchingMessage: string;
      pinnedData?: { label: string; value: React.ReactNode }[];
      transactionData?: { label: string; value: React.ReactNode }[];
    }) => (
      <div data-testid="transaction-overview-stub">
        <p>{title}</p>
        {isFetching ? (
          <p>{fetchingMessage}</p>
        ) : (
          [...(pinnedData ?? []), ...(transactionData ?? [])].map(row => (
            <div key={row.label}>
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          ))
        )}
      </div>
    )
  };
});

import { PendleRedeem } from '../PendleRedeem';

function renderComponent(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
  });
  return {
    container,
    rerender: (next: ReactNode) => {
      act(() => {
        root.render(<I18nProvider i18n={i18n}>{next}</I18nProvider>);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

const baseProps = {
  market: MARKET,
  ptBalance: 1_500_000n, // 1.5 PT-USDG (6 decimals)
  outputTokenList: [USDG_TOKEN, USDS_TOKEN],
  selectedOutputToken: USDG_TOKEN,
  onOutputTokenChange: () => undefined,
  quote: undefined,
  isFetchingQuote: false,
  slippage: 0.01
};

describe('PendleRedeem', () => {
  it('renders the full PT balance in the read-only input tile', () => {
    const { container, unmount } = renderComponent(<PendleRedeem {...baseProps} />);

    expect(container.textContent).toContain('1.5');
    expect(container.textContent).toContain('PT-USDG');
    // TokenSelector appends `-menu-button` to dataTestId.
    expect(
      // eslint-disable-next-line testing-library/no-container
      container.querySelector('[data-testid="pendle-redeem-output-token-menu-button"]')?.textContent
    ).toContain('USDG');

    unmount();
  });

  it('renders the slippage tolerance from the slippage prop and strips trailing zeros', () => {
    // aggregatorType set so the aggregator-only rows (Min. received,
    // Slippage tolerance, Price impact) render — they're hidden on the
    // pure-redeem path. See commit 75402e8c.
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_500_000n,
      apiMinOut: 1_485_000n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: 0,
      aggregatorType: 'KYBERSWAP',
      fetchedAt: Date.now(),
      apiContractParams: [],
      apiContractParamsName: []
    };
    const { container, rerender, unmount } = renderComponent(
      <PendleRedeem {...baseProps} slippage={0.01} quote={quote} />
    );
    expect(container.textContent).toContain('1%');
    expect(container.textContent).not.toContain('1.00%');

    rerender(<PendleRedeem {...baseProps} slippage={0.025} quote={quote} />);
    expect(container.textContent).toContain('2.5%');
    expect(container.textContent).not.toContain('2.50%');

    unmount();
  });

  it('renders the dropdown trigger', () => {
    const { container, unmount } = renderComponent(<PendleRedeem {...baseProps} />);
    // eslint-disable-next-line testing-library/no-container
    const trigger = container.querySelector(
      '[data-testid="pendle-redeem-output-token-menu-button"]'
    ) as HTMLButtonElement | null;
    expect(trigger).not.toBeNull();
    unmount();
  });

  it('renders the inline prepare-error banner when prepareErrorMessage is set', () => {
    const message = 'Current market price exceeds your slippage tolerance.';
    const { container, unmount } = renderComponent(
      <PendleRedeem {...baseProps} prepareErrorMessage={message} />
    );

    // eslint-disable-next-line testing-library/no-container
    const banner = container.querySelector('[data-testid="pendle-redeem-prepare-error"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain(message);
    expect(banner?.getAttribute('role')).toBe('alert');

    unmount();
  });

  it('omits the prepare-error banner when prepareErrorMessage is undefined', () => {
    const { container, unmount } = renderComponent(<PendleRedeem {...baseProps} />);
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('[data-testid="pendle-redeem-prepare-error"]')).toBeNull();
    unmount();
  });

  it('renders the quote-derived rows when a quote is provided', () => {
    // aggregatorType set so Min. received and Price impact render — those rows
    // are hidden on the pure-redeem (no-aggregator) path per commit 75402e8c.
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_499_500n,
      apiMinOut: 1_484_505n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: -0.0012,
      aggregatorType: 'KYBERSWAP',
      fetchedAt: Date.now(),
      apiContractParams: [],
      apiContractParamsName: []
    };
    const { container, unmount } = renderComponent(<PendleRedeem {...baseProps} quote={quote} />);

    // Min received is rendered in the overview alongside the underlying symbol.
    expect(container.textContent).toContain('USDG');
    expect(container.textContent).toContain('Min. received');
    expect(container.textContent).toContain('Price impact');

    unmount();
  });

  // --- APP-268: overview amount/symbol assertions ---------------------------
  // Verifies the specific values + unit suffixes that appear in the pinned
  // headline ("You redeem" / "You receive") and details. The stub at the top
  // of this file renders pinnedData + transactionData inline, so we can read
  // them out of container.textContent.

  it('overview pins "You redeem" with PT symbol/decimals and "You receive" with output symbol', () => {
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_499_500n, // 1.4995 USDG (6 decimals)
      apiMinOut: 1_484_505n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: 0,
      fetchedAt: Date.now(),
      apiContractParams: [],
      apiContractParamsName: []
    };
    const { container, unmount } = renderComponent(
      <PendleRedeem {...baseProps} quote={quote} selectedOutputToken={USDG_TOKEN} />
    );

    // PT side: 1.5 PT-USDG (ptBalance = 1_500_000n, 6 decimals on the fixture market)
    expect(container.textContent).toContain('You redeem');
    expect(container.textContent).toContain('1.5 PT-USDG');
    // Output side: 1.4995 USDG (output token decimals = 6, USDG symbol)
    expect(container.textContent).toContain('You receive');
    expect(container.textContent).toContain('1.4995 USDG');
    // Headline must NOT label "You receive" with the PT symbol.
    expect(container.textContent).not.toContain('1.4995 PT-USDG');
    unmount();
  });

  it('"You receive" reflects the chosen output token symbol/decimals (USDS, 18d)', () => {
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_499_500_000_000_000_000n, // 1.4995 USDS (18 decimals)
      apiMinOut: 1_484_505_000_000_000_000n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: 0,
      fetchedAt: Date.now(),
      apiContractParams: [],
      apiContractParamsName: []
    };
    const { container, unmount } = renderComponent(
      <PendleRedeem {...baseProps} quote={quote} selectedOutputToken={USDS_TOKEN} />
    );

    expect(container.textContent).toContain('1.4995 USDS');
    // Cross-decimals guard: would have rendered as a huge number if the
    // formatter used 6 decimals (USDG) instead of 18 (USDS).
    expect(container.textContent).not.toContain('1499500000000');
    unmount();
  });

  it('"Min. received" (aggregator path) uses output-token decimals + symbol', () => {
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_499_500n,
      apiMinOut: 1_484_505n, // 1.4845 USDG
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: -0.0012,
      aggregatorType: 'KYBERSWAP', // gates Min. received row
      fetchedAt: Date.now(),
      apiContractParams: [],
      apiContractParamsName: []
    };
    const { container, unmount } = renderComponent(
      <PendleRedeem {...baseProps} quote={quote} selectedOutputToken={USDG_TOKEN} />
    );
    expect(container.textContent).toContain('Min. received');
    expect(container.textContent).toContain('1.4845 USDG');
    unmount();
  });

  it('"Slippage tolerance" + "Price impact" render with sign-flipped percentages on aggregator routes', () => {
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_499_500n,
      apiMinOut: 1_484_505n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: -0.0012, // API negative = unfavorable → displayed positive 0.12%
      aggregatorType: 'OKX',
      fetchedAt: Date.now(),
      apiContractParams: [],
      apiContractParamsName: []
    };
    const { container, unmount } = renderComponent(
      <PendleRedeem {...baseProps} quote={quote} slippage={0.005} />
    );
    expect(container.textContent).toContain('Slippage tolerance');
    expect(container.textContent).toContain('0.5%');
    expect(container.textContent).toContain('0.12%');
    unmount();
  });

  it('"Routed via" with no aggregator says "Pendle redeem"', () => {
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_499_500n,
      apiMinOut: 1_484_505n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: 0,
      fetchedAt: Date.now(),
      apiContractParams: [],
      apiContractParamsName: []
    };
    const { container, unmount } = renderComponent(<PendleRedeem {...baseProps} quote={quote} />);
    expect(container.textContent).toContain('Pendle redeem');
    // Should NOT contain the aggregator-arrow variant.
    expect(container.textContent).not.toContain('→');
    unmount();
  });

  it('"Routed via" with aggregator says "Pendle redeem → <aggregator>"', () => {
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_499_500n,
      apiMinOut: 1_484_505n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: 0,
      aggregatorType: 'KYBERSWAP', // formats to "KyberSwap"
      fetchedAt: Date.now(),
      apiContractParams: [],
      apiContractParamsName: []
    };
    const { container, unmount } = renderComponent(<PendleRedeem {...baseProps} quote={quote} />);
    expect(container.textContent).toContain('Pendle redeem → KyberSwap');
    unmount();
  });

  it('"Pendle fee" renders "$0.0363" (small) and "$12.35" (>= 1) and "Included in quote" (undefined)', () => {
    // Small fee.
    const small = renderComponent(
      <PendleRedeem
        {...baseProps}
        quote={{
          method: 'exitPostExpToToken',
          amountOut: 1_499_500n,
          apiMinOut: 1_484_505n,
          effectiveApy: 0,
          impliedApy: 0,
          priceImpact: 0,
          feeUsd: 0.0363,
          fetchedAt: Date.now(),
          apiContractParams: [],
          apiContractParamsName: []
        }}
      />
    );
    expect(small.container.textContent).toContain('$0.0363');
    small.unmount();

    // Large fee.
    const large = renderComponent(
      <PendleRedeem
        {...baseProps}
        quote={{
          method: 'exitPostExpToToken',
          amountOut: 1_499_500n,
          apiMinOut: 1_484_505n,
          effectiveApy: 0,
          impliedApy: 0,
          priceImpact: 0,
          feeUsd: 12.345,
          fetchedAt: Date.now(),
          apiContractParams: [],
          apiContractParamsName: []
        }}
      />
    );
    expect(large.container.textContent).toContain('$12.35');
    large.unmount();

    // Undefined fee → "Included in quote".
    const none = renderComponent(
      <PendleRedeem
        {...baseProps}
        quote={{
          method: 'exitPostExpToToken',
          amountOut: 1_499_500n,
          apiMinOut: 1_484_505n,
          effectiveApy: 0,
          impliedApy: 0,
          priceImpact: 0,
          fetchedAt: Date.now(),
          apiContractParams: [],
          apiContractParamsName: []
        }}
      />
    );
    expect(none.container.textContent).toContain('Included in quote');
    none.unmount();
  });

  it('"Effective APY" renders only when non-zero (conditional row)', () => {
    // Zero APY: row hidden.
    const zero = renderComponent(
      <PendleRedeem
        {...baseProps}
        quote={{
          method: 'exitPostExpToToken',
          amountOut: 1_499_500n,
          apiMinOut: 1_484_505n,
          effectiveApy: 0,
          impliedApy: 0,
          priceImpact: 0,
          fetchedAt: Date.now(),
          apiContractParams: [],
          apiContractParamsName: []
        }}
      />
    );
    expect(zero.container.textContent).not.toContain('Effective APY');
    zero.unmount();

    // Non-zero APY: row present with percentage formatting.
    const nonZero = renderComponent(
      <PendleRedeem
        {...baseProps}
        quote={{
          method: 'exitPostExpToToken',
          amountOut: 1_499_500n,
          apiMinOut: 1_484_505n,
          effectiveApy: 0.0354,
          impliedApy: 0,
          priceImpact: 0,
          fetchedAt: Date.now(),
          apiContractParams: [],
          apiContractParamsName: []
        }}
      />
    );
    expect(nonZero.container.textContent).toContain('Effective APY');
    expect(nonZero.container.textContent).toContain('3.54%');
    nonZero.unmount();
  });
});
