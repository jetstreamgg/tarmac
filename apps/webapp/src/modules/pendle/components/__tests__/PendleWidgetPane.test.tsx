/// <reference types="vite/client" />

import { act, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const hoisted = vi.hoisted(() => ({
  mockMarket: {
    name: 'PT-USDG',
    marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as `0x${string}`,
    ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548' as `0x${string}`,
    ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1' as `0x${string}`,
    syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927' as `0x${string}`,
    underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D' as `0x${string}`,
    underlyingSymbol: 'USDG',
    underlyingDecimals: 6,
    expiry: 1779926400 // far future
  }
}));

let mockSearchParams = new URLSearchParams();
const setSearchParamsMock = vi.fn(
  (next: URLSearchParams | ((params: URLSearchParams) => URLSearchParams)) => {
    mockSearchParams =
      typeof next === 'function' ? next(new URLSearchParams(mockSearchParams)) : new URLSearchParams(next);
  }
);

vi.mock('@jetstreamgg/sky-hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@jetstreamgg/sky-hooks')>();
  return {
    ...actual,
    PENDLE_MARKETS: [hoisted.mockMarket],
    isMarketMatured: () => false,
    // formatPendleApy was removed from the hooks layer; consumers now use
    // formatDecimalPercentage from @jetstreamgg/sky-utils directly.
    usePendleUserPtBalances: () => ({
      data: undefined,
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    usePendleMarketsApiData: () => ({
      data: undefined,
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    })
  };
});

vi.mock('@jetstreamgg/sky-utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@jetstreamgg/sky-utils')>();
  return {
    ...actual,
    isTestnetId: () => false
  };
});

vi.mock('@jetstreamgg/sky-widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@jetstreamgg/sky-widgets')>();
  return {
    ...actual,
    CardAnimationWrapper: ({ children }: { children: ReactNode }) => <>{children}</>,
    PendleWidget: () => <div data-testid="pendle-widget-stub" />,
    WidgetContainer: ({
      children,
      header,
      subHeader
    }: {
      children: ReactNode;
      header?: ReactNode;
      subHeader?: ReactNode;
    }) => (
      <div>
        {header}
        {subHeader}
        {children}
      </div>
    )
  };
});

vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, setSearchParamsMock]
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => 1,
    useConnection: () => ({ address: undefined, isConnected: false, isConnecting: false })
  };
});

vi.mock('motion/react', async importOriginal => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>
  };
});

vi.mock('@/modules/layout/components/Typography', () => ({
  Heading: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('../PendleMarketStatsCard', () => ({
  PendleMarketStatsCard: ({ market }: { market: { underlyingSymbol: string } }) => (
    <div data-testid="pendle-market-stats-card">PT-{market.underlyingSymbol}</div>
  )
}));

import { PendleWidgetPane } from '../PendleWidgetPane';

function renderComponent(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

const sharedProps = {
  onConnect: () => undefined,
  addRecentTransaction: () => undefined,
  locale: 'en',
  rightHeaderComponent: <span />,
  onNotification: () => undefined,
  enabled: false,
  referralCode: 0,
  shouldReset: false,
  legalBatchTxUrl: ''
};

describe('PendleWidgetPane', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('widget=pendle');
    setSearchParamsMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the overview list with the configured market when no ?market is set', () => {
    const { container, unmount } = renderComponent(<PendleWidgetPane {...sharedProps} />);

    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('[data-testid="pendle-widget-stub"]')).toBeNull();
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelectorAll('[data-testid="pendle-market-stats-card"]').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('All markets');

    unmount();
  });

  it('renders the PendleWidget when a known ?market is selected', () => {
    mockSearchParams = new URLSearchParams(
      'widget=pendle&pendle_module=market&market=0xc5b32dba5f29f8395fb9591e1a15f23a75214f33'
    );

    const { container, unmount } = renderComponent(<PendleWidgetPane {...sharedProps} />);

    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('[data-testid="pendle-widget-stub"]')).not.toBeNull();

    unmount();
  });

  it('falls back to the overview when ?market is unknown', () => {
    mockSearchParams = new URLSearchParams(
      'widget=pendle&pendle_module=market&market=0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'
    );

    const { container, unmount } = renderComponent(<PendleWidgetPane {...sharedProps} />);

    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('[data-testid="pendle-widget-stub"]')).toBeNull();
    expect(container.textContent).toContain('All markets');

    unmount();
  });
});
