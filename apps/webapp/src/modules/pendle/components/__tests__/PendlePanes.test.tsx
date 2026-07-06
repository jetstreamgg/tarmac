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
  activeMarket: {
    name: 'PT-USDG',
    slug: 'pt-usdg',
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
    slug: 'pt-matured',
    marketAddress: '0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1' as `0x${string}`,
    ptToken: '0xb2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2' as `0x${string}`,
    ytToken: '0xc3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3' as `0x${string}`,
    syToken: '0xd4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4' as `0x${string}`,
    underlyingToken: '0xe5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5e5' as `0x${string}`,
    underlyingSymbol: 'MATR',
    underlyingDecimals: 6,
    expiry: 1700000000 // 2023 — matured
  }
}));

let mockEntityParams: Record<string, string | undefined> = {};

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    PENDLE_MARKETS: [hoisted.activeMarket, hoisted.maturedMarket],
    getPendleMarketBySlug: (slug: string) =>
      [hoisted.activeMarket, hoisted.maturedMarket].find(m => m.slug === slug),
    isMarketMatured: (expiry: number) => expiry < 1_700_000_001 // matches the matured fixture
  };
});

vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return {
    ...actual,
    useRouteEntityParams: () => mockEntityParams
  };
});

vi.mock('@/modules/ui/hooks/useBreakpointIndex', () => ({
  useBreakpointIndex: () => ({ bpi: 3 })
}));

vi.mock('@/modules/app/components/TwoPane', () => ({
  TwoPane: ({ widget, details }: { widget: ReactNode; details: ReactNode }) => (
    <div data-testid="two-pane">
      {widget}
      {details}
    </div>
  )
}));

vi.mock('@/modules/app/components/DetailsLayout', () => ({
  DetailsLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('../PendleWidgetPane', () => ({
  PendleWidgetPane: () => <div data-testid="pendle-widget-pane-stub" />
}));

vi.mock('../PendleDetailsPane', () => ({
  PendleDetailsPane: () => <div data-testid="pendle-details-pane-stub" />
}));

vi.mock('../PendleProductDetail', () => ({
  PendleProductDetail: ({ market }: { market: { slug: string } }) => (
    <div data-testid="pendle-product-detail-stub" data-market-slug={market.slug} />
  )
}));

import { PendlePanes } from '../PendlePanes';

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

const query = (container: HTMLElement, testId: string) =>
  container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

describe('PendlePanes', () => {
  beforeEach(() => {
    mockEntityParams = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the full-width product detail when the slug resolves to a live market', () => {
    mockEntityParams = { slug: 'pt-usdg' };

    const { container, unmount } = renderComponent(<PendlePanes />);

    const detail = query(container, 'pendle-product-detail-stub');
    expect(detail).not.toBeNull();
    expect(detail?.dataset.marketSlug).toBe('pt-usdg');
    expect(query(container, 'two-pane')).toBeNull();

    unmount();
  });

  it('renders the legacy overview panes when no slug is set', () => {
    const { container, unmount } = renderComponent(<PendlePanes />);

    expect(query(container, 'two-pane')).not.toBeNull();
    expect(query(container, 'pendle-product-detail-stub')).toBeNull();

    unmount();
  });

  it('falls back to the overview for an unknown slug', () => {
    mockEntityParams = { slug: 'pt-does-not-exist' };

    const { container, unmount } = renderComponent(<PendlePanes />);

    expect(query(container, 'two-pane')).not.toBeNull();
    expect(query(container, 'pendle-product-detail-stub')).toBeNull();

    unmount();
  });

  it('falls back to the overview for a matured market slug', () => {
    mockEntityParams = { slug: 'pt-matured' };

    const { container, unmount } = renderComponent(<PendlePanes />);

    expect(query(container, 'two-pane')).not.toBeNull();
    expect(query(container, 'pendle-product-detail-stub')).toBeNull();

    unmount();
  });
});
