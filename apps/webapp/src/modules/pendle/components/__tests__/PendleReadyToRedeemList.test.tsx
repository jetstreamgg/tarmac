/// <reference types="vite/client" />

import { act } from 'react';
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
    slug: 'pt-usdg',
    marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as `0x${string}`,
    underlyingSymbol: 'USDG',
    underlyingDecimals: 6,
    expiry: 1779926400 // far future
  },
  maturedMarket: {
    name: 'PT-MATURED',
    slug: 'pt-matured',
    marketAddress: '0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1' as `0x${string}`,
    underlyingSymbol: 'MATR',
    underlyingDecimals: 6,
    expiry: 1700000000 // 2023 — matured
  },
  // Mutable connection + balances. Tests reassign these before render.
  userAddress: undefined as `0x${string}` | undefined,
  ptBalances: undefined as Record<`0x${string}`, bigint> | undefined
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
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
    })
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useConnection: () => ({ address: hoisted.userAddress })
  };
});

// The card pulls redeem previews/earnings/modal wiring — stub it; this suite
// covers the list's own held-matured filter, not the card.
vi.mock('../PendleMaturedPositionCard', () => ({
  PendleMaturedPositionCard: ({ market }: { market: { name: string } }) => (
    <div data-testid="pendle-matured-position-card">{market.name}</div>
  )
}));

import { PendleReadyToRedeemList } from '../PendleReadyToRedeemList';

describe('PendleReadyToRedeemList', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    hoisted.userAddress = undefined;
    hoisted.ptBalances = undefined;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const render = () => {
    act(() => {
      root.render(
        <I18nProvider i18n={i18n}>
          <PendleReadyToRedeemList />
        </I18nProvider>
      );
    });
  };

  it('renders nothing while disconnected', () => {
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n };
    render();
    expect(container.querySelector('[data-testid="pendle-ready-to-redeem"]')).toBeNull();
  });

  it('renders nothing when connected but holding zero matured PT', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 0n, [ACTIVE_MARKET_ADDRESS]: 5_000_000n };
    render();
    expect(container.querySelector('[data-testid="pendle-ready-to-redeem"]')).toBeNull();
  });

  it('renders a redeem card per matured market the user holds PT for — active markets excluded', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n, [ACTIVE_MARKET_ADDRESS]: 5_000_000n };
    render();
    expect(container.querySelector('[data-testid="pendle-ready-to-redeem"]')).not.toBeNull();
    expect(container.textContent).toContain('Your matured positions');
    const cards = container.querySelectorAll('[data-testid="pendle-matured-position-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toBe('PT-MATURED');
  });
});
