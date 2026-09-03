import { StrictMode, useEffect, useRef, useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig } from './transactionContract';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionStepProgression.test.tsx).
// The provider needs a live wagmi tree; these suites exercise the transaction
// state machine, so the shared chain switch is stubbed inert.
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ handleSwitchChain: vi.fn(), isSwitchPending: false, switchVariables: undefined })
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => 1,
  useChains: () => [{ id: 1, name: 'Ethereum' }],
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
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
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
      usdValue: 0,
      supportedChainIds: [1],
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

  it('the modal card wears app-loader-cover-hidden so a first-connect cover hides it (APP-515)', () => {
    renderModal(() => ({
      title: 'Supply to Sky Savings',
      transactionContent: <div>review</div>,
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: () => {}
    }));
    expect(screen.getByRole('dialog').className).toContain('app-loader-cover-hidden');
  });

  it('gates the entry confirm on the entry descriptor disabled flag', () => {
    const onConfirm = vi.fn();
    renderModal(() => ({
      title: 'Supply to Sky Savings',
      usdValue: 0,
      supportedChainIds: [1],
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
      usdValue: 0,
      supportedChainIds: [1],
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
    // We left the entry screen for the wallet/status screen — the loading CTA
    // is gone (Figma review); the status chip's "Confirm in the wallet" label
    // is the surviving marker of this screen/status...
    expect(screen.queryByText(/confirm in the wallet/i)).not.toBeNull();
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
      usdValue: 0,
      supportedChainIds: [1],
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

  it('confirmAction overrides the entry CTA: fires in place, no screen advance, no onConfirm — and clearing it restores the confirm', () => {
    const connect = vi.fn();
    const onConfirm = vi.fn();
    const SESSION = 'upgrade-1';
    const get = renderModal(cb => ({
      title: 'Upgrade DAI/MKR',
      usdValue: 0,
      supportedChainIds: [1],
      sessionId: SESSION,
      entry: {
        content: <div>fields</div>,
        confirmLabel: 'Connect wallet',
        confirmDisabled: false,
        confirmAction: connect
      },
      // Mirror a real flow: confirm fires the engine, which calls back into the modal.
      onConfirm: () => {
        onConfirm();
        cb.onMutate();
      }
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));
    // The override ran in place: still on the entry screen, transaction untouched.
    expect(connect).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(/confirm this transaction in your wallet/i)).toBeNull();

    // The wallet connects: the body pushes the normal confirm back (the
    // upgrade form's connected state).
    act(() => {
      get().updateModalContent(SESSION, {
        entry: { confirmLabel: 'Continue', confirmAction: undefined }
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/confirm in the wallet/i)).not.toBeNull();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('renders the two-CTA entry footer and routes each CTA to its own handler (Figma 1036:214001)', () => {
    const onConfirm = vi.fn();
    const onSecondaryConfirm = vi.fn();
    renderModal(cb => ({
      title: 'Claim rewards',
      usdValue: 0,
      supportedChainIds: [1],
      entry: {
        content: <div>rewards</div>,
        confirmLabel: 'Claim & Restake SKY',
        confirmDisabled: false,
        secondaryConfirmLabel: 'Claim',
        secondaryConfirmDisabled: false
      },
      onConfirm,
      onSecondaryConfirm: () => {
        onSecondaryConfirm();
        cb.onMutate();
      }
    }));

    expect(screen.queryByRole('button', { name: 'Claim & Restake SKY' })).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));

    // The secondary CTA fires its own handler — not the primary's — and
    // advances to the wallet/status screen like the primary would.
    expect(onSecondaryConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(/confirm in the wallet/i)).not.toBeNull();
  });

  it('gates the secondary CTA on its own disabled flag, pushed live like the primary', () => {
    const onSecondaryConfirm = vi.fn();
    const SESSION = 'stake-claim-1';
    const get = renderModal(() => ({
      title: 'Claim rewards',
      usdValue: 0,
      supportedChainIds: [1],
      sessionId: SESSION,
      entry: {
        content: <div>rewards</div>,
        confirmLabel: 'Claim & Restake SKY',
        confirmDisabled: false,
        secondaryConfirmLabel: 'Claim',
        secondaryConfirmDisabled: true
      },
      onConfirm: () => {},
      onSecondaryConfirm
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    expect(onSecondaryConfirm).not.toHaveBeenCalled();

    act(() => get().updateModalContent(SESSION, { entry: { secondaryConfirmDisabled: false } }));
    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    expect(onSecondaryConfirm).toHaveBeenCalledTimes(1);
  });

  it('review-only configs (no entry) are unchanged: review renders first, confirm advances', () => {
    const onConfirm = vi.fn();
    renderModal(cb => ({
      title: 'Upgrade',
      usdValue: 0,
      supportedChainIds: [1],
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
    expect(screen.queryByText(/confirm in the wallet/i)).not.toBeNull();
  });
});

describe('TransactionModal — engine error slot', () => {
  it('renders entry.errorMessage above the confirm and drops it when the body pushes undefined (engine recovered)', () => {
    const SESSION = 'savings-supply-err';
    const get = renderModal(() => ({
      title: 'Supply to Sky Savings',
      sessionId: SESSION,
      entry: {
        content: <div>fields</div>,
        confirmLabel: 'Supply',
        confirmDisabled: true,
        errorMessage: 'Something went wrong preparing the transaction. Please try again.'
      },
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: () => {}
    }));

    const error = screen.getByTestId('transaction-modal-error');
    expect(error.textContent).toMatch(/something went wrong preparing/i);

    // The engine recovers: the body pushes errorMessage: undefined (the
    // always-push contract) and re-enables the confirm.
    act(() =>
      get().updateModalContent(SESSION, { entry: { confirmDisabled: false, errorMessage: undefined } })
    );
    expect(screen.queryByTestId('transaction-modal-error')).toBeNull();
  });

  it('renders the top-level errorMessage on a review-only config (no entry)', () => {
    renderModal(() => ({
      title: 'Review conversion',
      transactionContent: <div data-testid="review-body">review</div>,
      confirmLabel: 'Confirm',
      confirmDisabled: true,
      errorMessage: 'Something went wrong preparing the transaction. Please try again.',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: () => {}
    }));

    expect(screen.queryByTestId('review-body')).not.toBeNull();
    expect(screen.getByTestId('transaction-modal-error').textContent).toMatch(
      /something went wrong preparing/i
    );
  });

  it('appears when a live push surfaces a prepare failure mid-session', () => {
    const SESSION = 'vault-withdraw-err';
    const get = renderModal(() => ({
      title: 'Withdraw',
      sessionId: SESSION,
      entry: { content: <div>fields</div>, confirmLabel: 'Review', confirmDisabled: false },
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: () => {}
    }));

    expect(screen.queryByTestId('transaction-modal-error')).toBeNull();

    act(() =>
      get().updateModalContent(SESSION, {
        entry: { confirmDisabled: true, errorMessage: 'Insufficient vault liquidity for this withdrawal.' }
      })
    );
    expect(screen.getByTestId('transaction-modal-error').textContent).toMatch(
      /insufficient vault liquidity/i
    );
  });
});
