/// <reference types="vite/client" />

import { act, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const ACTIVE_MARKET_ADDRESS = '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as const;
const MATURED_MARKET_ADDRESS = '0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1' as const;

const hoisted = vi.hoisted(() => ({
  activeMarket: {
    name: 'PT-USDG',
    marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as `0x${string}`,
    ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548' as `0x${string}`,
    ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1' as `0x${string}`,
    syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927' as `0x${string}`,
    underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D' as `0x${string}`,
    underlyingSymbol: 'USDG',
    underlyingDecimals: 6,
    expiry: 1779926400 // far future
  },
  maturedMarket: {
    name: 'PT-MATURED',
    marketAddress: '0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1' as `0x${string}`,
    ptToken: '0xb2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2' as `0x${string}`,
    ytToken: '0xc3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3' as `0x${string}`,
    syToken: '0xd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4' as `0x${string}`,
    underlyingToken: '0xe5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5' as `0x${string}`,
    underlyingSymbol: 'MATR',
    underlyingDecimals: 6,
    expiry: 1700000000 // 2023 — matured
  },
  // Mutable connection + balances. Tests reassign these before render.
  userAddress: undefined as `0x${string}` | undefined,
  ptBalances: undefined as Record<`0x${string}`, bigint> | undefined
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
    PENDLE_MARKETS: [hoisted.activeMarket, hoisted.maturedMarket],
    isMarketMatured: (expiry: number) => expiry < 1_700_000_001, // matches the matured fixture
    usePendleUserPtBalances: () => ({
      data: hoisted.ptBalances,
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
    useConnection: () => ({
      address: hoisted.userAddress,
      isConnected: !!hoisted.userAddress,
      isConnecting: false
    })
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
  PendleMarketStatsCard: ({ market }: { market: { marketAddress: string; underlyingSymbol: string } }) => (
    <div data-testid="pendle-market-stats-card" data-market={market.marketAddress}>
      PT-{market.underlyingSymbol}
    </div>
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

const cardAddresses = (container: HTMLElement): string[] =>
  // eslint-disable-next-line testing-library/no-container
  Array.from(container.querySelectorAll<HTMLElement>('[data-testid="pendle-market-stats-card"]')).map(
    el => el.dataset.market ?? ''
  );

describe('PendleWidgetPane', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams('widget=pendle');
    setSearchParamsMock.mockClear();
    // Reset connection + balances between tests.
    hoisted.userAddress = undefined;
    hoisted.ptBalances = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the overview list with the configured market when no ?market is set', () => {
    const { container, unmount } = renderComponent(<PendleWidgetPane {...sharedProps} />);

    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('[data-testid="pendle-widget-stub"]')).toBeNull();
    expect(cardAddresses(container).length).toBeGreaterThan(0);
    expect(container.textContent).toContain('All markets');

    unmount();
  });

  it('renders the PendleWidget when a known ?market is selected', () => {
    mockSearchParams = new URLSearchParams(
      `widget=pendle&pendle_module=market&market=${ACTIVE_MARKET_ADDRESS}`
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

  // ---- Matured-market filter behavior ----

  describe('matured-market filter', () => {
    it('hides matured markets from a disconnected user', () => {
      // userAddress = undefined, balances = undefined
      const { container, unmount } = renderComponent(<PendleWidgetPane {...sharedProps} />);

      const addresses = cardAddresses(container);
      expect(addresses).toContain(ACTIVE_MARKET_ADDRESS);
      expect(addresses).not.toContain(MATURED_MARKET_ADDRESS);

      unmount();
    });

    it('hides matured markets when connected but holding zero PT', () => {
      hoisted.userAddress = '0x000000000000000000000000000000000000beef';
      hoisted.ptBalances = {
        [ACTIVE_MARKET_ADDRESS]: 0n,
        [MATURED_MARKET_ADDRESS]: 0n
      };

      const { container, unmount } = renderComponent(<PendleWidgetPane {...sharedProps} />);

      const addresses = cardAddresses(container);
      expect(addresses).toContain(ACTIVE_MARKET_ADDRESS);
      expect(addresses).not.toContain(MATURED_MARKET_ADDRESS);

      unmount();
    });

    it('shows a matured market in My positions when the user holds PT for it', () => {
      hoisted.userAddress = '0x000000000000000000000000000000000000beef';
      hoisted.ptBalances = {
        [ACTIVE_MARKET_ADDRESS]: 0n,
        [MATURED_MARKET_ADDRESS]: 100n // user has matured PT to redeem
      };

      const { container, unmount } = renderComponent(<PendleWidgetPane {...sharedProps} />);

      // Both groups render their own card; matured one should be in "My positions"
      const addresses = cardAddresses(container);
      expect(addresses).toContain(MATURED_MARKET_ADDRESS);
      expect(addresses).toContain(ACTIVE_MARKET_ADDRESS);
      expect(container.textContent).toContain('My positions');

      unmount();
    });

    it('shows an active market in My positions when the user holds PT for it', () => {
      hoisted.userAddress = '0x000000000000000000000000000000000000beef';
      hoisted.ptBalances = {
        [ACTIVE_MARKET_ADDRESS]: 100n,
        [MATURED_MARKET_ADDRESS]: 0n
      };

      const { container, unmount } = renderComponent(<PendleWidgetPane {...sharedProps} />);

      const addresses = cardAddresses(container);
      expect(addresses).toContain(ACTIVE_MARKET_ADDRESS);
      expect(addresses).not.toContain(MATURED_MARKET_ADDRESS);
      expect(container.textContent).toContain('My positions');

      unmount();
    });
  });
});
