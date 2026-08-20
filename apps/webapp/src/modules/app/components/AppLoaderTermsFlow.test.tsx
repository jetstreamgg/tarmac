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
 * TermsModalProvider + TermsModal + TermsDialog + useAppLoader wired together,
 * with ConnectedContext replaced by a live test double. E2E can't reach this
 * flow — VITE_SKIP_AUTH_CHECK auto-accepts terms in every e2e environment —
 * so this suite is where the ordering is pinned deterministically.
 */

const ADDRESS = '0x00000000000000000000000000000000000000aa';

const h = vi.hoisted(() => ({
  isConnected: false,
  address: undefined as string | undefined,
  onConnectCallbacks: [] as ((data: { address: string; isReconnected: boolean }) => void)[],
  scrolledToEnd: false,
  disconnect: undefined as ReturnType<typeof vi.fn> | undefined,
  navigate: undefined as ReturnType<typeof vi.fn> | undefined,
  signMutation: undefined as { onSuccess?: (data: string) => void } | undefined
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
  useSignMessage: (config: { mutation: { onSuccess?: (data: string) => void } }) => ({
    signMessage: () => {
      h.signMutation = config.mutation;
      config.mutation.onSuccess?.('0xsignature');
    }
  }),
  useDisconnect: () => ({ disconnect: h.disconnect! })
}));
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => h.navigate!,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/portfolio' } })
}));
vi.mock('@/hooks', () => ({
  useEarnMarketplace: () => ({ rows: [], isPositionsLoading: true })
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

// The scroll-to-end gate is an IntersectionObserver in TermsDialog; drive it
// from the holder so tests control when "the user read to the bottom".
vi.mock('react-intersection-observer', () => ({
  useInView: () => [() => {}, h.scrolledToEnd]
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
vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ isModalOpen: false })
}));
vi.mock('@/modules/ui/components/terms-loader', () => ({
  getTermsContent: () => '# Terms of use'
}));
vi.mock('@/modules/ui/components/markdown/TermsMarkdownRenderer', () => ({
  TermsMarkdownRenderer: ({ markdown }: { markdown: string }) => <div>{markdown}</div>
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
      setHasAcceptedTerms,
      isCheckingTerms: false,
      termsCheckError: false,
      retryTermsCheck: () => {},
      isAuthorized: true,
      authData: { authIsLoading: false },
      vpnData: { vpnIsLoading: false }
    }),
    [hasAcceptedTerms]
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
  h.address = undefined;
  h.onConnectCallbacks = [];
  h.navigate = vi.fn();
  h.scrolledToEnd = false;
  h.disconnect = vi.fn();
  // Must sit on sanitizeUrl's domain allowlist or the POST silently drops.
  vi.stubEnv('VITE_TERMS_ENDPOINT', 'https://staging-api.sky.money/terms-acceptance');
  vi.stubEnv('VITE_TERMS_MESSAGE_TO_SIGN', 'test terms message');
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
    expect(screen.queryByTestId('end-of-terms')).toBeNull();

    connect(rerender);

    expect(screen.getByTestId('end-of-terms')).toBeTruthy();
    expect(phase()).toBe('off');
    expect(screen.queryByTestId('app-loader')).toBeNull();
    // The gate, not the timing: checkbox locked until the terms are read.
    expect((screen.getByRole('checkbox') as HTMLButtonElement).disabled).toBe(true);
  });

  it('signing accepts the terms, closes the modal, and only then releases the loader', async () => {
    const { rerender } = render(<Harness />);
    connect(rerender);
    expect(phase()).toBe('off');

    // Read to the end, then check the box — TermsModal signs on check, the
    // signature POSTs to the terms endpoint, and acceptance flips.
    h.scrolledToEnd = true;
    rerender(<Harness />);
    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(screen.queryByTestId('end-of-terms')).toBeNull());
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://staging-api.sky.money/terms-acceptance/add');
    // Acceptance is what releases the loader: the cover is up only now.
    expect(phase()).toBe('cover');
    expect(screen.getByTestId('app-loader')).toBeTruthy();
  });

  it('rejecting the terms disconnects and never shows the loader', () => {
    const { rerender } = render(<Harness />);
    connect(rerender);

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(h.disconnect).toHaveBeenCalled();
    expect(screen.queryByTestId('end-of-terms')).toBeNull();
    expect(phase()).toBe('off');
    expect(screen.queryByTestId('app-loader')).toBeNull();
  });
});
