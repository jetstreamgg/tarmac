import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_LOADER_PLAYED_KEY, AppLoaderOverlay, appLoaderRevealClasses, useAppLoader } from './AppLoader';
import { writePortfolioDecision } from '@/lib/portfolioDecisionCache';

const ADDRESS = '0x00000000000000000000000000000000000000aa';

const h = vi.hoisted(() => ({
  status: 'disconnected' as string,
  address: undefined as string | undefined,
  acceptedTerms: false,
  // The mocked motion.div parks its onAnimationComplete here so tests can
  // finish the cover timeline on demand.
  completeCover: undefined as (() => void) | undefined
}));

vi.mock('wagmi', () => ({
  useConnection: () => ({ status: h.status, address: h.address })
}));
vi.mock('@/modules/ui/context/ConnectedContext', () => ({
  useConnectedContext: () => ({ isConnectedAndAcceptedTerms: h.acceptedTerms })
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
  const { phase, endCover } = useAppLoader();
  return (
    <>
      <div data-testid="content" className={appLoaderRevealClasses(phase, 'content')} />
      <div data-testid="chrome" className={appLoaderRevealClasses(phase, 'chrome')} />
      <AppLoaderOverlay phase={phase} onCoverEnd={endCover} />
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  h.status = 'disconnected';
  h.address = undefined;
  h.acceptedTerms = false;
  h.completeCover = undefined;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useAppLoader', () => {
  it('covers from first paint when a first-visit wallet is reconnecting', () => {
    h.status = 'reconnecting';
    render(<Harness />);
    expect(screen.getByTestId('app-loader')).toBeTruthy();
    expect(screen.getByTestId('content').className).toBe('opacity-0');
    expect(screen.getByTestId('chrome').className).toBe('opacity-0');
    expect(localStorage.getItem(APP_LOADER_PLAYED_KEY)).not.toBeNull();
  });

  it('stays off when the browser already holds a cached portfolio decision', () => {
    h.status = 'reconnecting';
    writePortfolioDecision(ADDRESS, { outcome: 'none', tab: 'supplied' });
    render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('');
  });

  it('stays off once it has ever played', () => {
    h.status = 'reconnecting';
    localStorage.setItem(APP_LOADER_PLAYED_KEY, '123');
    render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
  });

  it('stays off for a plain disconnected visit', () => {
    render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('');
    expect(screen.getByTestId('chrome').className).toBe('');
  });

  it('plays on a mid-session first connect, after terms are accepted', () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();

    h.status = 'connected';
    h.address = ADDRESS;
    h.acceptedTerms = true;
    rerender(<Harness />);

    expect(screen.getByTestId('app-loader')).toBeTruthy();
    expect(localStorage.getItem(APP_LOADER_PLAYED_KEY)).not.toBeNull();
  });

  it('skips the mid-session play when the connecting address has a cached decision', () => {
    writePortfolioDecision(ADDRESS, { outcome: 'allocate', tab: 'idle' });
    const { rerender } = render(<Harness />);
    h.status = 'connected';
    h.address = ADDRESS;
    h.acceptedTerms = true;
    rerender(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
  });

  it('reveals when the cover timeline completes', () => {
    h.status = 'reconnecting';
    render(<Harness />);
    expect(screen.getByTestId('app-loader')).toBeTruthy();

    act(() => h.completeCover?.());

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('animate-app-loader-content-reveal');
    expect(screen.getByTestId('chrome').className).toBe('animate-app-loader-chrome-reveal');
  });

  it('never plays under prefers-reduced-motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    h.status = 'reconnecting';
    render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
  });

  it('stays down while the connected wallet has not accepted terms yet', () => {
    h.status = 'connected';
    h.address = ADDRESS;
    h.acceptedTerms = false;
    render(<Harness />);
    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('');
  });

  it('plays the cover through even if the reconnect fails midway', () => {
    h.status = 'reconnecting';
    const { rerender } = render(<Harness />);
    expect(screen.getByTestId('app-loader')).toBeTruthy();

    // wagmi gives up on the persisted connection while the icon still spins.
    h.status = 'disconnected';
    rerender(<Harness />);

    expect(screen.getByTestId('app-loader')).toBeTruthy();
    act(() => h.completeCover?.());
    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('animate-app-loader-content-reveal');
  });

  it('is one-shot per page load: never replays after revealing', () => {
    h.status = 'reconnecting';
    const { rerender } = render(<Harness />);
    act(() => h.completeCover?.());
    expect(screen.queryByTestId('app-loader')).toBeNull();

    // Even wiping the flags and satisfying the mid-session predicate must not
    // bring the cover back within the same page load.
    localStorage.clear();
    h.status = 'connected';
    h.address = ADDRESS;
    h.acceptedTerms = true;
    rerender(<Harness />);

    expect(screen.queryByTestId('app-loader')).toBeNull();
    expect(screen.getByTestId('content').className).toBe('animate-app-loader-content-reveal');
  });
});
