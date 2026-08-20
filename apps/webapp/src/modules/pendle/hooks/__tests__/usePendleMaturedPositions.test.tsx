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
  chainId: 1,
  setSearchParamsMock: vi.fn(),
  setIsSwitchingNetworkMock: vi.fn(),
  setIsAutoSwitchingMock: vi.fn()
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
    useConnection: () => ({ address: hoisted.userAddress }),
    useChainId: () => hoisted.chainId,
    // Production-like chain list (no tenderly fork) so the L2 auto-switch
    // targets ethereum; the fork-preferring variant is covered by the
    // widget-network-map unit tests.
    useChains: () => [
      { id: 1, name: 'Ethereum' },
      { id: 8453, name: 'Base' }
    ]
  };
});

vi.mock('@/lib/navigation', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/navigation')>();
  return {
    ...actual,
    useAppSearchParams: () => [new URLSearchParams(), hoisted.setSearchParamsMock]
  };
});

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    isSwitchingNetwork: false,
    setIsSwitchingNetwork: hoisted.setIsSwitchingNetworkMock,
    isAutoSwitching: false,
    setIsAutoSwitching: hoisted.setIsAutoSwitchingMock
  })
}));

import { usePendleMaturedNetworkSwitch, usePendleMaturedPositions } from '../usePendleMaturedPositions';

/** Probe pairing the hooks the way PortfolioPositionsSection does. */
function Probe() {
  const { maturedPositions, onPendleChain } = usePendleMaturedPositions();
  usePendleMaturedNetworkSwitch(maturedPositions.length > 0);
  return (
    <div data-testid="probe" data-on-pendle-chain={onPendleChain}>
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
    hoisted.chainId = 1;
    hoisted.setSearchParamsMock.mockClear();
    hoisted.setIsSwitchingNetworkMock.mockClear();
    hoisted.setIsAutoSwitchingMock.mockClear();
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

  it('auto-switches to Ethereum when holding matured PT on an L2 — once per mount, flagged automatic', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n };
    hoisted.chainId = 8453; // Base
    render();
    // The switch rides the ?network= param (the orchestration performs the
    // wallet switch and the shell toast announces it), flagged as automatic.
    expect(hoisted.setIsSwitchingNetworkMock).toHaveBeenCalledWith(true);
    expect(hoisted.setIsAutoSwitchingMock).toHaveBeenCalledWith(true);
    expect(hoisted.setSearchParamsMock).toHaveBeenCalledTimes(1);
    const updater = hoisted.setSearchParamsMock.mock.calls[0][0] as (p: URLSearchParams) => URLSearchParams;
    expect(updater(new URLSearchParams()).get('network')).toBe('ethereum');
    // A declined prompt (chain unchanged) must not re-fire on re-render.
    render();
    expect(hoisted.setSearchParamsMock).toHaveBeenCalledTimes(1);
    // The positions stay listed while off-chain — the cards disable Claim instead.
    expect(positions()).toHaveLength(1);
    expect(container.querySelector('[data-testid="probe"]')?.getAttribute('data-on-pendle-chain')).toBe(
      'false'
    );
  });

  it('does not switch on mainnet', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n };
    render();
    expect(hoisted.setSearchParamsMock).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="probe"]')?.getAttribute('data-on-pendle-chain')).toBe(
      'true'
    );
  });

  it('does not switch on a tenderly testnet — the fork session is valid for redemption', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [MATURED_MARKET_ADDRESS]: 1_000_000n };
    hoisted.chainId = 314310; // tenderly vnet
    render();
    expect(hoisted.setSearchParamsMock).not.toHaveBeenCalled();
    expect(positions()).toHaveLength(1);
  });

  it('does not switch off-chain when there is nothing to redeem', () => {
    hoisted.userAddress = '0x1111111111111111111111111111111111111111';
    hoisted.ptBalances = { [ACTIVE_MARKET_ADDRESS]: 5_000_000n };
    hoisted.chainId = 8453;
    render();
    expect(hoisted.setSearchParamsMock).not.toHaveBeenCalled();
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
