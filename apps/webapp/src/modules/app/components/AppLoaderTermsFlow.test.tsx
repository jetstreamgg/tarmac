import { useMemo, useState } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppLoaderOverlay, useAppLoader } from './AppLoader';
import { TermsModalProvider } from '@/modules/ui/context/TermsModalContext';
import { TermsModal } from '@/modules/ui/components/TermsModal';

/**
 * The loader/terms contract, driven through the REAL modal machinery:
 * TermsModalProvider + TermsModal + useAppLoader wired together, with
 * ConnectedContext replaced by a live test double. E2E can't reach this
 * flow — VITE_SKIP_AUTH_CHECK auto-accepts terms in every e2e environment —
 * so this suite is where the ordering is pinned deterministically.
 */

const ADDRESS = '0x00000000000000000000000000000000000000aa';

const h = vi.hoisted(() => ({
  isConnected: false,
  isAuthorized: true,
  address: undefined as string | undefined,
  onConnectCallbacks: [] as ((data: { address: string; isReconnected: boolean }) => void)[],
  disconnect: undefined as ReturnType<typeof vi.fn> | undefined,
  navigate: undefined as ReturnType<typeof vi.fn> | undefined
}));

vi.mock('wagmi', async importOriginal => ({
  ...(await importOriginal<typeof import('wagmi')>()),
  useConnection: () => ({
    status: h.isConnected ? 'connected' : 'disconnected',
    isConnected: h.isConnected,
    address: h.address,
    chainId: 1,
    connector: { name: 'mock' }
  }),
  useConnectionEffect: (config: {
    onConnect?: (data: { address: string; isReconnected: boolean }) => void;
  }) => {
    if (config.onConnect) h.onConnectCallbacks.push(config.onConnect);
  },
  useDisconnect: () => ({ disconnect: h.disconnect! })
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => h.navigate!,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/portfolio' } })
}));
vi.mock('@/hooks', () => ({
  useEarnMarketplace: () => ({ rows: [], isPositionsLoading: true }),
  // ResponsiveModal (inside TermsModal) reads the breakpoint from the barrel;
  // pin the desktop tier so the modal composes as a Dialog deterministically.
  BP: { sm: 0, md: 1, lg: 2, desktop: 3, xl: 4, '2xl': 5 },
  useBreakpointIndex: () => ({ bpi: 3 })
}));
vi.mock('@/modules/portfolio/hooks/useStablecoinBalances', () => ({
  useStablecoinBalances: () => ({ balances: [], isLoading: true })
}));
vi.mock('@/modules/portfolio/hooks/useGeoVisibleRows', () => ({
  useGeoVisibleRows: (rows: unknown[]) => rows
}));
vi.mock('@/modules/geo-config', () => ({
  useGeoConfig: () => ({ isModuleEnabled: () => true, isLoading: false })
}));

// ConnectedContext gets a live double below (real React context, so state
// updates propagate); everything else the modal pulls in is trimmed to keep
// the suite on the flow, not the prose.
vi.mock('@/modules/ui/context/ConnectedContext', async () => {
  const React = await import('react');
  const TestConnectedContext = React.createContext<unknown>(null);
  return {
    TestConnectedContext,
    useConnectedContext: () => React.useContext(TestConnectedContext)
  };
});
vi.mock('@/modules/ui/context/ConnectModalContext', () => ({
  useConnectModal: () => ({ openConnectModal: () => {} })
}));
vi.mock('@/modules/sentry/reportError', () => ({
  reportError: vi.fn()
}));

const { TestConnectedContext } = (await import('@/modules/ui/context/ConnectedContext')) as any;

i18n.load('en', {});
i18n.activate('en');

function LoaderProbe() {
  const { phase, coverMode, released, endCover } = useAppLoader();
  return (
    <>
      <div data-testid="loader-phase" data-phase={phase} />
      <AppLoaderOverlay phase={phase} mode={coverMode} released={released} onCoverEnd={endCover} />
    </>
  );
}

/** The shell slice under test: connected-state double wrapping modal + loader. */
function Harness() {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const value = useMemo(
    () => ({
      isConnectedAndAcceptedTerms: h.isConnected && hasAcceptedTerms,
      hasAcceptedTerms,
      hasSignedCurrentTerms: false,
      latestTermsVersion: '2026-01-15',
      // Stands in for the real Phase A write (POST /add, then the local flag),
      // which ConnectedContext owns and its own suite covers.
      acceptTerms: async () => {
        setHasAcceptedTerms(true);
        return true;
      },
      isCheckingTerms: false,
      termsCheckError: false,
      retryTermsCheck: () => {},
      isAuthorized: h.isAuthorized,
      authData: { authIsLoading: false },
      vpnData: { vpnIsLoading: false }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- h.isAuthorized is test-harness state read at render time
    [hasAcceptedTerms, h.isAuthorized]
  );
  return (
    <I18nProvider i18n={i18n}>
      <TestConnectedContext.Provider value={value}>
        <TermsModalProvider>
          <LoaderProbe />
          <TermsModal />
        </TermsModalProvider>
      </TestConnectedContext.Provider>
    </I18nProvider>
  );
}

const phase = () => screen.getByTestId('loader-phase').getAttribute('data-phase');

const connect = (rerender: (ui: React.ReactElement) => void) => {
  h.isConnected = true;
  h.address = ADDRESS;
  rerender(<Harness />);
  act(() => h.onConnectCallbacks.forEach(cb => cb({ address: ADDRESS, isReconnected: false })));
};

beforeEach(() => {
  localStorage.clear();
  h.isConnected = false;
  h.isAuthorized = true;
  h.address = undefined;
  h.onConnectCallbacks = [];
  h.navigate = vi.fn();
  h.disconnect = vi.fn();
  // Must sit on sanitizeUrl's domain allowlist or the POST silently drops.
  vi.stubEnv('VITE_TERMS_ENDPOINT', 'https://staging-api.sky.money/terms-acceptance');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({}) }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('loader/terms flow (real modal)', () => {
  it('connecting opens the terms modal and the loader stays down behind it', () => {
    const { rerender } = render(<Harness />);
    expect(screen.queryByTestId('terms-modal')).toBeNull();

    connect(rerender);

    expect(screen.getByTestId('terms-modal')).toBeTruthy();
    expect(phase()).toBe('off');
    expect(screen.queryByTestId('app-loader')).toBeNull();
    // The gate: the box is unchecked by default, so the CTA starts disabled.
    // (The scroll-to-end gate is gone with the embedded document — APP-500.)
    expect((screen.getByRole('button', { name: 'Agree and continue' }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it('accepting closes the modal, and only then releases the loader', async () => {
    const { rerender } = render(<Harness />);
    connect(rerender);
    expect(phase()).toBe('off');

    // Tick the box, then agree. Ticking no longer accepts anything on its
    // own — the signature that used to fire here is gone.
    fireEvent.click(screen.getByRole('checkbox'));
    expect(screen.getByTestId('terms-modal')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Agree and continue' }));

    await waitFor(() => expect(screen.queryByTestId('terms-modal')).toBeNull());
    // Acceptance is what releases the loader: the cover is up only now.
    expect(phase()).toBe('cover');
    expect(screen.getByTestId('app-loader')).toBeTruthy();
  });

  // The APP-497 ordering: address screening sits between wallet selection and
  // the T&C gate. While `isAuthorized` is false (screening pending, or the
  // wallet is blocked), the terms modal must not open — the blocked/loading UI
  // owns the screen. It opens only once screening resolves in favor.
  it('holds the terms modal until screening authorizes the wallet', () => {
    h.isAuthorized = false;
    const { rerender } = render(<Harness />);

    connect(rerender);
    expect(screen.queryByTestId('terms-modal')).toBeNull();

    h.isAuthorized = true;
    rerender(<Harness />);

    expect(screen.getByTestId('terms-modal')).toBeTruthy();
    expect(phase()).toBe('off');
  });

  // Found in APP-497 browser QA: a modal state latched open during a
  // connection (e.g. behind the blocked-wallet screen) must not survive the
  // disconnect and greet whatever connects next.
  it('disconnecting clears any open terms modal', () => {
    const { rerender } = render(<Harness />);
    connect(rerender);
    expect(screen.getByTestId('terms-modal')).toBeTruthy();

    h.isConnected = false;
    h.address = undefined;
    rerender(<Harness />);

    expect(screen.queryByTestId('terms-modal')).toBeNull();
  });

  it('cancelling the terms disconnects and never shows the loader', () => {
    const { rerender } = render(<Harness />);
    connect(rerender);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(h.disconnect).toHaveBeenCalled();
    expect(screen.queryByTestId('terms-modal')).toBeNull();
    expect(phase()).toBe('off');
    expect(screen.queryByTestId('app-loader')).toBeNull();
  });
});
