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

vi.mock('@jetstreamgg/sky-widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@jetstreamgg/sky-widgets')>();
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
      transactionData
    }: {
      title: string;
      isFetching: boolean;
      fetchingMessage: string;
      transactionData?: { label: string; value: React.ReactNode }[];
    }) => (
      <div data-testid="transaction-overview-stub">
        <p>{title}</p>
        {isFetching ? (
          <p>{fetchingMessage}</p>
        ) : (
          transactionData?.map(row => (
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
      container.querySelector('[data-testid="pendle-redeem-output-token-menu-button"]')?.textContent
    ).toContain('USDG');

    unmount();
  });

  it('renders the slippage tolerance from the slippage prop and strips trailing zeros', () => {
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_500_000n,
      apiMinOut: 1_485_000n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: 0,
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

    const banner = container.querySelector('[data-testid="pendle-redeem-prepare-error"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain(message);
    expect(banner?.getAttribute('role')).toBe('alert');

    unmount();
  });

  it('omits the prepare-error banner when prepareErrorMessage is undefined', () => {
    const { container, unmount } = renderComponent(<PendleRedeem {...baseProps} />);
    expect(container.querySelector('[data-testid="pendle-redeem-prepare-error"]')).toBeNull();
    unmount();
  });

  it('renders the quote-derived rows when a quote is provided', () => {
    const quote = {
      method: 'exitPostExpToToken',
      amountOut: 1_499_500n,
      apiMinOut: 1_484_505n,
      effectiveApy: 0,
      impliedApy: 0,
      priceImpact: -0.0012,
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
});
