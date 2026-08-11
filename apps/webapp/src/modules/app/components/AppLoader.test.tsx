import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_LOADER_PLAYED_KEY, AppLoaderOverlay, appLoaderRevealClasses, useAppLoader } from './AppLoader';
import { readPortfolioDecision, writePortfolioDecision } from '@/lib/portfolioDecisionCache';

const ADDRESS = '0x00000000000000000000000000000000000000aa';

const h = vi.hoisted(() => ({
  status: 'disconnected' as string,
  address: undefined as string | undefined,
  acceptedTerms: false,
  pathname: '/portfolio',
  navigate: undefined as ReturnType<typeof vi.fn> | undefined,
  onConnectCallbacks: [] as ((data: { address: string; isReconnected: boolean }) => void)[],
  marketplace: {
    rows: [] as { position?: { totalUsd: number } }[],
    isPositionsLoading: true,
    isPositionsError: false
  },
  balances: { balances: [] as { amountUsd: number }[], isLoading: true, isError: false },
  geoLoading: false,
  // The mocked motion.div parks its onAnimationComplete here so tests can
  // finish the active timeline segment on demand.
  completeCover: undefined as (() => void) | undefined
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ status: h.status, address: h.address }),
  useConnectionEffect: (config: {
    onConnect?: (data: { address: string; isReconnected: boolean }) => void;
  }) => {
    if (config.onConnect) h.onConnectCallbacks.push(config.onConnect);
  }
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => h.navigate!,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: h.pathname } })
}));
vi.mock('@/modules/ui/context/ConnectedContext', () => ({
  useConnectedContext: () => ({ isConnectedAndAcceptedTerms: h.acceptedTerms })
}));
vi.mock('@/hooks', () => ({
  useEarnMarketplace: () => h.marketplace
}));
vi.mock('@/modules/portfolio/hooks/useStablecoinBalances', () => ({
  useStablecoinBalances: () => h.balances
}));
vi.mock('@/modules/portfolio/hooks/useGeoVisibleRows', () => ({
  useGeoVisibleRows: (rows: unknown[]) => rows
}));
vi.mock('@/modules/geo-config', () => ({
  useGeoConfig: () => ({ isModuleEnabled: () => true, isLoading: h.geoLoading })
}));
vi.mock('motion/react', () => ({
  motion: {
    div: ({
      onAnimationComplete,
      children
    }: {
      onAnimationComplete?: () => void;
      children?: React.ReactNode;
    }) => {
      h.completeCover = onAnimationComplete;
      return <div>{children}</div>;
    }
  }
}));
vi.mock('@/modules/icons/IllustrationSkyLogomark', () => ({
  IllustrationSkyLogomark: () => <span data-testid="logomark" />
}));

/** The loader as Layout composes it: reveal classes + overlay off one hook. */
function Harness() {
  const { phase, coverMode, released, endCover } = useAppLoader();
  return (
    <>
      <div data-testid="content" className={appLoaderRevealClasses(phase, 'content')} />
      <div data-testid="chrome" className={appLoaderRevealClasses(phase, 'chrome')} />
      <AppLoaderOverlay phase={phase} mode={coverMode} released={released} onCoverEnd={endCover} />
    </>
  );
}

const rerenderHarness = (rerender: (ui: React.ReactElement) => void) => rerender(<Harness />);

const fireConnect = (isReconnected = false) =>
  act(() => h.onConnectCallbacks.forEach(cb => cb({ address: ADDRESS, isReconnected })));

const connectManually = (rerender: (ui: React.ReactElement) => void) => {
  h.status = 'connected';
  h.address = ADDRESS;
  h.acceptedTerms = true;
  fireConnect(false);
  rerenderHarness(rerender);
};

const settleEmptyWallet = () => {
  h.marketplace = { rows: [], isPositionsLoading: false, isPositionsError: false };
  h.balances = { balances: [], isLoading: false, isError: false };
};

const settleFundedWallet = () => {
  h.marketplace = {
    rows: [{ position: { totalUsd: 5000 } }],
    isPositionsLoading: false,
    isPositionsError: false
  };
  h.balances = { balances: [], isLoading: false, isError: false };
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  h.status = 'disconnected';
  h.address = undefined;
  h.acceptedTerms = false;
  h.pathname = '/portfolio';
  h.navigate = vi.fn();
  h.onConnectCallbacks = [];
  h.marketplace = { rows: [], isPositionsLoading: true, isPositionsError: false };
  h.balances = { balances: [], isLoading: true, isError: false };
  h.geoLoading = false;
  h.completeCover = undefined;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useAppLoader', () => {
  it('covers from first paint when a first-visit wallet is reconnecting', () => {
    h.status = 'reconnecting';
    render(<Harness />);
    expect(screen.getByTestId('app-loader')).toBeTruthy();
    expect(screen.getByTestId('content').className).toBe('pointer-events-none opacity-0');
    expect(screen.getByTestId('chrome').className).toBe('pointer-events-none opacity-0');
    expect(localStorage.getItem(APP_LOADER_PLAYED_KEY)).not.toBeNull();
  });

  it('stays off when the browser already holds a cached portfolio decision', () => {
    h.status = 'reconnecting';
    writePortfolioDecision(ADDRESS, { outcome: 'none', tab: 'supplied' });
    render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('');
  });

  it('the entry gate stays off once it has ever played in this browser', () => {
    h.status = 'reconnecting';
    localStorage.setItem(APP_LOADER_PLAYED_KEY, '123');
    render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
  });

  it('a new address still gets the held cover in a browser that already played', () => {
    // The played flag is per browser, but the fetch and sort are per wallet:
    // an address with no cached decision is covered on its manual connect.
    localStorage.setItem(APP_LOADER_PLAYED_KEY, '123');
    const { rerender } = render(<Harness />);
    connectManually(rerender);
    expect(screen.getByTestId('app-loader')).toBeTruthy();
  });

  it('stays off for a plain disconnected visit', () => {
    render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('');
    expect(screen.getByTestId('chrome').className).toBe('');
  });

  it('an entry-gate play reveals when its fixed timeline completes', () => {
    h.status = 'reconnecting';
    render(<Harness />);
    expect(screen.getByTestId('app-loader')).toBeTruthy();

    act(() => h.completeCover?.());

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('animate-app-loader-content-reveal');
    expect(screen.getByTestId('chrome').className).toBe('animate-app-loader-chrome-reveal');
  });

  it('plays a held cover on a manual first connect, after terms are accepted', () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();

    connectManually(rerender);

    expect(screen.getByTestId('app-loader')).toBeTruthy();
    expect(localStorage.getItem(APP_LOADER_PLAYED_KEY)).not.toBeNull();
  });

  it('holds the cover while terms are pending, arms once they are accepted', () => {
    const { rerender } = render(<Harness />);
    h.status = 'connected';
    h.address = ADDRESS;
    fireConnect(false);
    rerenderHarness(rerender);
    expect(screen.queryByTestId('app-loader')).toBeNull();

    h.acceptedTerms = true;
    rerenderHarness(rerender);
    expect(screen.getByTestId('app-loader')).toBeTruthy();
  });

  it('never treats wagmi auto-reconnect as a manual connect', () => {
    const { rerender } = render(<Harness />);
    h.status = 'connected';
    h.address = ADDRESS;
    h.acceptedTerms = true;
    fireConnect(true);
    rerenderHarness(rerender);
    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('sorts an empty wallet from /portfolio to /earn under the cover, then releases', () => {
    const { rerender } = render(<Harness />);
    connectManually(rerender);
    expect(screen.getByTestId('app-loader')).toBeTruthy();

    settleEmptyWallet();
    // The settle only applies after the minimum hold has elapsed.
    act(() => vi.advanceTimersByTime(1200));
    rerenderHarness(rerender);

    expect(h.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/earn', replace: true }));
    expect(readPortfolioDecision(ADDRESS)).toMatchObject({ outcome: 'simulate', tab: 'idle' });

    // Release → exit timeline → reveal.
    act(() => h.completeCover?.());
    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('animate-app-loader-content-reveal');
  });

  it('keeps a funded wallet on /portfolio: cache written, no navigation', () => {
    const { rerender } = render(<Harness />);
    connectManually(rerender);

    settleFundedWallet();
    act(() => vi.advanceTimersByTime(1200));
    rerenderHarness(rerender);

    expect(h.navigate).not.toHaveBeenCalled();
    expect(readPortfolioDecision(ADDRESS)).toMatchObject({ outcome: 'none', tab: 'supplied' });
  });

  it('never sorts away from a non-home surface', () => {
    h.pathname = '/earn/savings';
    const { rerender } = render(<Harness />);
    connectManually(rerender);
    expect(screen.getByTestId('app-loader')).toBeTruthy();

    settleEmptyWallet();
    act(() => vi.advanceTimersByTime(1200));
    rerenderHarness(rerender);

    expect(h.navigate).not.toHaveBeenCalled();
    // The visual play and the cache write still happen.
    expect(readPortfolioDecision(ADDRESS)).not.toBeNull();
  });

  it('a cached decision sorts instantly on manual connect, without a cover', () => {
    writePortfolioDecision(ADDRESS, { outcome: 'none', tab: 'supplied' });
    h.pathname = '/earn';
    const { rerender } = render(<Harness />);
    connectManually(rerender);

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(h.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/portfolio', replace: true }));
  });

  it('a cached decision that matches the surface does nothing at all', () => {
    writePortfolioDecision(ADDRESS, { outcome: 'none', tab: 'supplied' });
    h.pathname = '/portfolio';
    const { rerender } = render(<Harness />);
    connectManually(rerender);

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('the cap releases a wedged sort without navigating', () => {
    const { rerender } = render(<Harness />);
    connectManually(rerender);
    expect(screen.getByTestId('app-loader')).toBeTruthy();

    // Queries never settle; the cap fires and the cover exits anyway.
    act(() => vi.advanceTimersByTime(8000));
    rerenderHarness(rerender);
    act(() => h.completeCover?.());

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('content').className).toBe('animate-app-loader-content-reveal');
  });

  it('the watchdog reveals a cover whose timeline never completes', () => {
    h.status = 'reconnecting';
    render(<Harness />);
    expect(screen.getByTestId('app-loader')).toBeTruthy();

    // onAnimationComplete never fires (crashed subtree, dropped animation,
    // background tab): the watchdog forces the reveal.
    act(() => vi.advanceTimersByTime(2500));

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('animate-app-loader-content-reveal');
  });

  it('a failed source releases the cover without caching or sorting', () => {
    const { rerender } = render(<Harness />);
    connectManually(rerender);
    expect(screen.getByTestId('app-loader')).toBeTruthy();

    h.marketplace = { rows: [], isPositionsLoading: false, isPositionsError: true };
    h.balances = { balances: [], isLoading: false, isError: false };
    act(() => vi.advanceTimersByTime(1200));
    rerenderHarness(rerender);
    act(() => h.completeCover?.());

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(readPortfolioDecision(ADDRESS)).toBeNull();
  });

  it('never plays under prefers-reduced-motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const { rerender } = render(<Harness />);
    connectManually(rerender);
    expect(screen.queryByTestId('app-loader')).toBeNull();
  });

  it('is one-shot per page load: never replays after revealing', () => {
    h.status = 'reconnecting';
    const { rerender } = render(<Harness />);
    act(() => h.completeCover?.());
    expect(screen.queryByTestId('app-loader')).toBeNull();

    // Even wiping the flags and firing a manual connect must not bring the
    // cover back within the same page load.
    localStorage.clear();
    connectManually(rerender);

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('animate-app-loader-content-reveal');
  });
});
