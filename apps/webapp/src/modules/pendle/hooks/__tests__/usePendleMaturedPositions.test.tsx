/// <reference types="vite/client" />

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

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
  // Mutable connection + balances + chain. Tests reassign these before render.
  userAddress: undefined as `0x${string}` | undefined,
  ptBalances: undefined as Record<`0x${string}`, bigint> | undefined,
  balancesError: undefined as Error | undefined,
  geo: { fixedEnabled: true, isLoading: false }
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
      error: hoisted.balancesError,
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

vi.mock('@/modules/geo-config', () => ({
  useGeoConfig: () => ({
    isModuleEnabled: (id: string) => (id === 'fixed' ? hoisted.geo.fixedEnabled : true),
    isLoading: hoisted.geo.isLoading
  })
}));

import { usePendleMaturedPositions } from '../usePendleMaturedPositions';

function Probe() {
  const { maturedPositions, isLoading } = usePendleMaturedPositions();
  return (
    <div data-testid="probe" data-loading={String(isLoading)}>
      {maturedPositions.map(({ market }) => (
        <span key={market.marketAddress} data-testid="matured-position">
          {market.name}
        </span>
      ))}
    </div>
  );
}

describe('usePendleMaturedPositions', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    hoisted.userAddress = undefined;
    hoisted.ptBalances = undefined;
    hoisted.balancesError = undefined;
    hoisted.geo = { fixedEnabled: true, isLoading: false };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const render = () => {
    act(() => {
      root.render(<Probe />);
    });
  };

  const positions = () => container.querySelectorAll('[data-testid="matured-position"]');

  it('returns nothing while disconnected', () => {
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n };
    render();
    expect(positions()).toHaveLength(0);
  });

  it('returns nothing when connected but holding zero matured PT', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 0n, [ACTIVE_MARKET_ADDRESS]: 5_000_000n };
    render();
    expect(positions()).toHaveLength(0);
  });

  it('reports loading while the balances read is unresolved', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    render();
    expect(container.querySelector('[data-testid="probe"]')?.getAttribute('data-loading')).toBe('true');
  });

  it('settles — not loading, no positions — when the balances read fails', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.balancesError = new Error('multicall failed');
    render();
    expect(container.querySelector('[data-testid="probe"]')?.getAttribute('data-loading')).toBe('false');
    expect(positions()).toHaveLength(0);
  });

  it('hides matured positions while the fixed module is geo-restricted (APP-484)', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n };
    hoisted.geo = { fixedEnabled: false, isLoading: false };
    render();
    expect(positions()).toHaveLength(0);
  });

  it('passes positions through while the geo config is still loading (restrictive default)', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n };
    hoisted.geo = { fixedEnabled: false, isLoading: true };
    render();
    expect(positions()).toHaveLength(1);
  });

  it('lists one position per matured market the user holds PT for — active markets excluded', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n, [ACTIVE_MARKET_ADDRESS]: 5_000_000n };
    render();
    const cards = positions();
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toBe('PT-MATURED');
  });
});
