import { StrictMode, useEffect, useRef, useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig } from './transactionContract';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionStepProgression.test.tsx).
vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => 1,
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000001', isConnected: true })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useIsBatchSupported: () => ({ data: false })
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [false, () => {}] }));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({
    trackWidgetReviewViewed: vi.fn(),
    trackTransactionStarted: vi.fn(),
    trackTransactionCompleted: vi.fn()
  })
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn() })
}));

// Render motion elements synchronously so AnimatePresence transitions are deterministic.
vi.mock('motion/react', async io => {
  const actual = await io<typeof import('motion/react')>();
  const React = await import('react');
  const MOTION_PROPS = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'layout']);
  const strip = (props: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_PROPS.has(key)));
  const tag =
    (element: string) =>
    ({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) =>
      React.createElement(element, strip(rest), children);
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    motion: new Proxy({}, { get: (_t, element) => tag(element as string) })
  };
});

import { TransactionProvider, useTransaction } from './TransactionContext';

i18n.load('en', {});
i18n.activate('en');

// Launches `config` on mount once (with the live txCallbacks spread in so the
// status screen can be driven by the test).
function Harness({
  build,
  onReady
}: {
  build: (cb: ReturnType<typeof useTransaction>['txCallbacks']) => TransactionConfig;
  onReady: (api: ReturnType<typeof useTransaction>) => void;
}) {
  const api = useTransaction();
  const { launch, txCallbacks } = api;
  const started = useRef(false);
  // The config's closures must drive the LIVE session's callbacks: real
  // engines capture the current value when they fire, and callbacks are bound
  // to the session generation that rendered them — a config baked with the
  // pre-launch object would be stale. Delegate through a ref instead.
  const cbRef = useRef(txCallbacks);
  useEffect(() => {
    cbRef.current = txCallbacks;
  });
  const [liveCb] = useState<ReturnType<typeof useTransaction>['txCallbacks']>(() => ({
    onMutate: () => cbRef.current.onMutate(),
    onStart: hash => cbRef.current.onStart(hash),
    onSuccess: hash => cbRef.current.onSuccess(hash),
    onError: (error, hash) => cbRef.current.onError(error, hash)
  }));
  // Report the latest api on every render (post-launch callbacks included).
  useEffect(() => {
    onReady(api);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch(build(liveCb));
  }, [launch, build, liveCb]);
  return null;
}

function renderModal(build: (cb: ReturnType<typeof useTransaction>['txCallbacks']) => TransactionConfig) {
  let api!: ReturnType<typeof useTransaction>;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness build={build} onReady={a => (api = a)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  return () => api;
}

afterEach(() => vi.clearAllMocks());

describe('TransactionModal — editable entry step', () => {
  it('renders the entry content first (not a review) when an entry descriptor is present', () => {
    renderModal(() => ({
      title: 'Supply to Sky Savings',
      // The read-only review content must NOT be what shows first in entry mode.
      transactionContent: <div data-testid="review-body">review</div>,
      entry: {
        content: <input data-testid="entry-input" aria-label="amount" />,
        confirmLabel: 'Supply',
        confirmDisabled: true
      },
      onConfirm: () => {}
    }));

    // The editable entry body is on screen; the review body is not.
    expect(screen.queryByTestId('entry-input')).not.toBeNull();
    expect(screen.queryByTestId('review-body')).toBeNull();
    // The confirm button carries the entry's label.
    expect(screen.queryByRole('button', { name: 'Supply' })).not.toBeNull();
  });

  it('gates the entry confirm on the entry descriptor disabled flag', () => {
    const onConfirm = vi.fn();
    renderModal(() => ({
      title: 'Supply to Sky Savings',
      entry: { content: <div>fields</div>, confirmLabel: 'Supply', confirmDisabled: true },
      onConfirm
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));
    // Disabled → the click does nothing and we stay on the entry screen.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(/confirm this transaction in your wallet/i)).toBeNull();
  });

  it('confirming an enabled entry fires the transaction and advances to the wallet/status screen', () => {
    const onConfirm = vi.fn();
    const get = renderModal(cb => ({
      title: 'Supply to Sky Savings',
      entry: {
        content: <div data-testid="entry-fields">fields</div>,
        confirmLabel: 'Supply',
        confirmDisabled: false
      },
      // Mirror a real flow: confirm fires the engine, which calls back into the modal.
      onConfirm: () => {
        onConfirm();
        cb.onMutate();
      }
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // We left the entry screen for the wallet/status screen...
    expect(screen.queryByText(/confirm this transaction in your wallet/i)).not.toBeNull();
    // ...but the entry body stays MOUNTED (just hidden) so the engine hook it owns
    // can observe the receipt and fire onSuccess. Unmounting it here would strand the
    // modal in LOADING — the has-position supply/withdraw stuck-modal bug.
    const entryFields = screen.queryByTestId('entry-fields');
    expect(entryFields).not.toBeNull();
    expect(entryFields?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(get().txStatus).toBeDefined();
  });

  it('live-syncs the entry disabled flag + onConfirm via updateModalContent (merge keeps content mounted)', () => {
    const staleConfirm = vi.fn();
    const freshConfirm = vi.fn();
    const SESSION = 'savings-supply-1';
    const get = renderModal(() => ({
      title: 'Supply to Sky Savings',
      sessionId: SESSION,
      // Start disabled with a placeholder confirm — the in-modal body takes over.
      entry: {
        content: <div data-testid="entry-fields">fields</div>,
        confirmLabel: 'Supply',
        confirmDisabled: true
      },
      onConfirm: staleConfirm
    }));

    // Disabled at launch.
    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));
    expect(staleConfirm).not.toHaveBeenCalled();

    // The body (simulated) enables the button and swaps in the real confirm,
    // WITHOUT re-pushing entry.content.
    act(() =>
      get().updateModalContent(SESSION, { entry: { confirmDisabled: false }, onConfirm: freshConfirm })
    );

    // Content stayed mounted through the merge.
    expect(screen.queryByTestId('entry-fields')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));
    expect(freshConfirm).toHaveBeenCalledTimes(1);
    expect(staleConfirm).not.toHaveBeenCalled();
  });

  it('review-only configs (no entry) are unchanged: review renders first, confirm advances', () => {
    const onConfirm = vi.fn();
    renderModal(cb => ({
      title: 'Upgrade',
      transactionContent: <div data-testid="review-body">review</div>,
      confirmLabel: 'Confirm',
      onConfirm: () => {
        onConfirm();
        cb.onMutate();
      }
    }));

    // Review body shows first; there is no entry input.
    expect(screen.queryByTestId('review-body')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/confirm this transaction in your wallet/i)).not.toBeNull();
  });
});
