import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';
import type { PreTransactionGate } from './preTransactionGate';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads.
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
const analytics = vi.hoisted(() => ({
  trackWidgetReviewViewed: vi.fn(),
  trackTransactionStarted: vi.fn(),
  trackTransactionCompleted: vi.fn(),
  trackTermsSignatureDeclined: vi.fn()
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => analytics
}));
const toastWithCloseMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({
  toast: { dismiss: vi.fn() },
  toastWithClose: toastWithCloseMock
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
}));

// Render motion elements synchronously so AnimatePresence step transitions are deterministic.
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

// Launches the given config on mount and hands the engine callbacks to the test.
function Harness({ config, onReady }: { config: TransactionConfig; onReady?: (cb: TxCallbacks) => void }) {
  const { launch, txCallbacks } = useTransaction();
  const started = useRef(false);
  useEffect(() => {
    onReady?.(txCallbacks);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch(config);
  }, [launch, config]);
  return null;
}

// Mounts the provider (under StrictMode, mirroring the app) with an injected
// gate and returns the latest engine callbacks.
function renderWithGate(gate: PreTransactionGate, config: TransactionConfig): TxCallbacks {
  let cb!: TxCallbacks;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider gate={gate}>
          <Harness config={config} onReady={c => (cb = c)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  return cb;
}

const flush = () => act(async () => {});

// Render the node the provider handed to toastWithClose (header + body notice).
const renderLastToast = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)![0] as (id: string) => ReactNode;
  return render(<I18nProvider i18n={i18n}>{renderFn('toast-id')}</I18nProvider>);
};

describe('TransactionProvider pre-transaction gate', () => {
  beforeEach(() => {
    i18n.activate('en');
  });
  afterEach(() => vi.clearAllMocks());

  it('a synchronous allow runs onConfirm in the same tick as the confirm click', () => {
    const onConfirm = vi.fn();
    const gate = vi.fn(() => ({ allow: true }));
    renderWithGate(gate, { title: 'Supply', usdValue: 0, supportedChainIds: [1], onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    // No flush between the click and this assertion: the engine contract
    // requires the write to start synchronously from the user's confirm.
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(gate).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'confirm' }));
  });

  it('an async allow defers onConfirm to the verdict, then runs it', async () => {
    const onConfirm = vi.fn();
    renderWithGate(async () => ({ allow: true }), {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a denial never runs onConfirm', async () => {
    const onConfirm = vi.fn();
    renderWithGate(() => ({ allow: false }), {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a rejected verdict counts as a denial', async () => {
    const onConfirm = vi.fn();
    renderWithGate(() => Promise.reject(new Error('gate exploded')), {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('an allow resolving after the session closed is dropped (generation guard)', async () => {
    const onConfirm = vi.fn();
    let resolveVerdict!: (v: { allow: boolean }) => void;
    const gate: PreTransactionGate = () => new Promise(resolve => (resolveVerdict = resolve));
    renderWithGate(gate, { title: 'Supply', usdValue: 0, supportedChainIds: [1], onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    // The user closes the modal while the verdict is still pending…
    fireEvent.click(screen.getByTestId('transaction-modal-close'));
    // …so the allow lands on a dead session and must not start the write.
    resolveVerdict({ allow: true });
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('retry re-runs the gate; a denied retry leaves the failure state untouched', async () => {
    const onConfirm = vi.fn();
    // Allow the initial confirm, deny the retry.
    const gate = vi.fn(({ trigger }: { trigger: string }) => ({ allow: trigger !== 'retry' }));
    const cb = renderWithGate(gate, { title: 'Supply', usdValue: 0, supportedChainIds: [1], onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => cb.onMutate());
    act(() => cb.onError(new Error('rejected in wallet')));

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(gate).toHaveBeenLastCalledWith(expect.objectContaining({ trigger: 'retry' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Denied: still on the failure screen, retry still available.
    expect(screen.getByRole('button', { name: /retry/i })).not.toBeNull();
  });

  it('a second gated call while a verdict is pending is ignored (in-flight latch)', async () => {
    const onConfirm = vi.fn();
    const gate = vi.fn(async () => ({ allow: true }));
    renderWithGate(gate, { title: 'Supply', usdValue: 0, supportedChainIds: [1], onConfirm });

    const confirm = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(gate).toHaveBeenCalledTimes(1);
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('the gate can mount a prelude signature step and drive the status around it', async () => {
    const onConfirm = vi.fn();
    let resolveSigned!: (ok: boolean) => void;
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setPreludeSteps([
        { label: 'Terms signature', kind: 'signature', description: 'Sign in your wallet' }
      ]);
      controls.setGateStatus('signature');
      return new Promise(resolve => {
        resolveSigned = (ok: boolean) => {
          if (!ok) controls.setGateStatus('error');
          resolve({ allow: ok });
        };
      });
    };
    const cb = renderWithGate(gate, {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm,
      steps: ['Supply USDS']
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    // The prelude renders ahead of the config's own step, active, with its copy.
    expect(screen.getByText('Terms signature')).not.toBeNull();
    expect(screen.getByText('Sign in your wallet')).not.toBeNull();
    expect(screen.getByText('Supply USDS')).not.toBeNull();

    act(() => resolveSigned(true));
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // The engine's first onMutate advances currentStep past the signature step
    // (the INITIALIZED-advancement rule) — no bespoke machinery.
    act(() => cb.onMutate());
    expect(screen.getByText('Terms signature')).not.toBeNull();
  });

  it('a lone signature prelude renders the step list even when the flow has no steps of its own', async () => {
    // The claim panel launches without a steps array — the prelude row is
    // where the signature's copy, links, and inline retry live, so it must
    // render regardless of the composed list length.
    const onConfirm = vi.fn();
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setPreludeSteps([
        { label: 'Terms signature', kind: 'signature', description: 'Sign in your wallet' }
      ]);
      controls.setGateStatus('signature');
      return Promise.resolve({ allow: false }).then(v => {
        controls.setGateStatus('error');
        return v;
      });
    };
    renderWithGate(gate, { title: 'Claim', usdValue: 0, supportedChainIds: [1], onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(screen.getByText('Terms signature')).not.toBeNull();
    expect(screen.getByText('Sign in your wallet')).not.toBeNull();

    await flush();
    // Inline failure applies to the lone prelude step too.
    expect(screen.getByText('Terms signature failed')).not.toBeNull();
    expect(screen.getByRole('button', { name: /try again/i })).not.toBeNull();
  });

  it('gate copy overrides the status message and subtitle while set', async () => {
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setPreludeSteps([{ label: 'Terms signature', kind: 'signature' }]);
      controls.setGateStatus('signature', {
        message: 'Sign the confirmation in your wallet.',
        subtitle: 'Signature needed to continue.'
      });
      return new Promise(() => {});
    };
    renderWithGate(gate, {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: vi.fn(),
      subtitles: { pending: 'Supplying your tokens...' },
      steps: ['Supply USDS']
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(screen.getByText('Sign the confirmation in your wallet.')).not.toBeNull();
    expect(screen.getByText('Signature needed to continue.')).not.toBeNull();
    // The flow's own pending copy stays hidden while the gate copy is set.
    expect(screen.queryByText('Supplying your tokens...')).toBeNull();
    // The chip is the only other status surface. A sign request really is
    // waiting in the wallet here, so it keeps the INITIALIZED label.
    expect(screen.getByTestId('transaction-status-badge').textContent).toContain('Confirm in the wallet');
  });

  it('the chip takes the gate\'s label while screening — not "Confirm in the wallet"', async () => {
    // Both gate phases render as INITIALIZED, but screening is an HTTP check:
    // a txStatus-keyed chip would send the user to a wallet showing nothing,
    // right beside the gate's own "Verifying your wallet address…".
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setGateStatus('screening', {
        message: 'Verifying your wallet address…',
        badgeLabel: 'Verifying'
      });
      return new Promise(() => {}); // the screen never resolves
    };
    renderWithGate(gate, {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: vi.fn(),
      steps: ['Supply USDS']
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();

    const badge = screen.getByTestId('transaction-status-badge');
    expect(badge.textContent).toContain('Verifying');
    expect(badge.textContent).not.toContain('Confirm in the wallet');
  });

  it("the engine's first onMutate clears the gate copy — the flow's narration takes over", async () => {
    let resolveSigned!: () => void;
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setPreludeSteps([{ label: 'Terms signature', kind: 'signature' }]);
      controls.setGateStatus('signature', {
        message: 'Sign the confirmation in your wallet.',
        subtitle: 'Signature needed to continue.'
      });
      return new Promise(resolve => (resolveSigned = () => resolve({ allow: true })));
    };
    const cb = renderWithGate(gate, {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: vi.fn(),
      subtitles: { pending: 'Supplying your tokens...' },
      steps: ['Supply USDS']
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(screen.getByText('Signature needed to continue.')).not.toBeNull();

    act(() => resolveSigned());
    await flush();
    act(() => cb.onMutate());

    expect(screen.queryByText('Signature needed to continue.')).toBeNull();
    expect(screen.queryByText('Sign the confirmation in your wallet.')).toBeNull();
    expect(screen.getByText('Supplying your tokens...')).not.toBeNull();
  });

  it('controls from a closed session are dead: no ghost prelude or status in the next session', async () => {
    // A US-user run awaiting its signature is closed mid-prompt, then a new
    // flow launches. The old continuation keeps its controls — every call
    // must no-op, and isStale must report it, or the new session inherits a
    // ghost signature step / error status / abandoned-prompt toast.
    const onConfirm = vi.fn();
    let staleControls!: Parameters<PreTransactionGate>[0]['controls'];
    let firstCall = true;
    const gate: PreTransactionGate = ({ controls }) => {
      if (firstCall) {
        firstCall = false;
        staleControls = controls;
        controls.setPreludeSteps([{ label: 'Terms signature', kind: 'signature' }]);
        controls.setGateStatus('signature');
        return new Promise(() => {}); // the wallet prompt never answered
      }
      return { allow: true };
    };

    function RelaunchHarness() {
      const { launch } = useTransaction();
      return (
        <>
          <button
            data-testid="launch-a"
            onClick={() => launch({ title: 'Flow A', usdValue: 0, supportedChainIds: [1], onConfirm })}
          >
            a
          </button>
          <button
            data-testid="launch-b"
            onClick={() =>
              launch({
                title: 'Flow B',
                usdValue: 0,
                supportedChainIds: [1],
                onConfirm,
                steps: ['Supply USDS']
              })
            }
          >
            b
          </button>
        </>
      );
    }
    render(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <TransactionProvider gate={gate}>
            <RelaunchHarness />
          </TransactionProvider>
        </I18nProvider>
      </StrictMode>
    );

    fireEvent.click(screen.getByTestId('launch-a'));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(screen.getByText('Terms signature')).not.toBeNull();
    expect(staleControls.isStale()).toBe(false);

    fireEvent.click(screen.getByTestId('transaction-modal-close'));
    expect(staleControls.isStale()).toBe(true);

    fireEvent.click(screen.getByTestId('launch-b'));
    // The old continuation fires its controls after the relaunch — all dead.
    act(() => {
      staleControls.setPreludeSteps([{ label: 'Ghost signature', kind: 'signature' }]);
      staleControls.setGateStatus('error', { subtitle: 'ghost copy' });
    });

    // Confirm flow B onto its transaction screen — the surface where a ghost
    // prelude, error status, or copy override would actually render.
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Ghost signature')).toBeNull();
    expect(screen.queryByText('ghost copy')).toBeNull();
    expect(screen.queryByText(/failed/i)).toBeNull();
  });

  it('a denied signature renders the failed step with inline retry, and retry re-runs the gate', async () => {
    const onConfirm = vi.fn();
    const gate = vi.fn(({ controls }: { controls: Parameters<PreTransactionGate>[0]['controls'] }) => {
      controls.setPreludeSteps([{ label: 'Terms signature', kind: 'signature' as const }]);
      controls.setGateStatus('signature');
      return Promise.resolve({ allow: false }).then(v => {
        controls.setGateStatus('error');
        return v;
      });
    });
    renderWithGate(gate as unknown as PreTransactionGate, {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm,
      steps: ['Supply USDS']
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
    // The signature step failed in place: retitled row + inline retry.
    expect(screen.getByText('Terms signature failed')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    await flush();
    expect(gate).toHaveBeenCalledTimes(2);
    expect(gate).toHaveBeenLastCalledWith(expect.objectContaining({ trigger: 'retry' }));
  });

  it('returnToFirstScreen hands a multi-step flow back to its first screen — no failed step, no error framing', async () => {
    // The C9 enhanced-denial shape: 'screening' while the verdict is fetched,
    // then returnToFirstScreen instead of a transaction-screen 'error' (which
    // the step list's failure rendering would swallow — the compliance copy
    // would never show and the denial would read as an on-chain failure).
    const onConfirm = vi.fn();
    let deny!: () => void;
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setGateStatus('screening');
      return new Promise(resolve => {
        deny = () => {
          controls.returnToFirstScreen();
          resolve({ allow: false });
        };
      });
    };
    renderWithGate(gate, {
      title: 'Supply',
      usdValue: 300_000,
      supportedChainIds: [1],
      onConfirm,
      steps: ['Approve USDS', 'Supply USDS']
    });

    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    // On the transaction screen while the gate screens: the step list is up.
    expect(screen.getByText('Approve USDS')).not.toBeNull();

    await act(async () => deny());

    // Back on the first screen at IDLE: the live confirm CTA is available
    // again (the preflight surface renders there), the step list is gone, and
    // nothing suggests an on-chain failure.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^confirm$/i })).not.toBeNull();
    expect(screen.queryByText('Approve USDS')).toBeNull();
    expect(screen.queryByRole('button', { name: /retry|try again/i })).toBeNull();
    expect(screen.queryByText(/failed/i)).toBeNull();
  });

  it("the entry's secondary CTA is gated with its own trigger", () => {
    const onConfirm = vi.fn();
    const onSecondaryConfirm = vi.fn();
    const gate = vi.fn(() => ({ allow: true }));
    renderWithGate(gate, {
      title: 'Claim',
      usdValue: 0,
      supportedChainIds: [1],
      entry: { content: <div />, secondaryConfirmLabel: 'Claim only' },
      onConfirm,
      onSecondaryConfirm
    });

    fireEvent.click(screen.getByRole('button', { name: /claim only/i }));
    expect(gate).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'secondaryConfirm' }));
    expect(onSecondaryConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('closing during the screening phase tears down silently: no cancelled event, no toast', async () => {
    // The re-screen holds INITIALIZED before any wallet interaction exists.
    // Closing here abandons nothing: no app_widget_flow_started has fired
    // (so a cancelled completion would pair with nothing) and no request is
    // sitting in the wallet (so the discarded-request toast would lie).
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setGateStatus('screening', { message: 'Verifying your wallet address…' });
      return new Promise(() => {}); // the re-screen never resolves
    };
    renderWithGate(gate, {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: vi.fn(),
      analytics: { widgetName: 'savings', flow: 'supply', action: 'supply' }
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    fireEvent.click(screen.getByTestId('transaction-modal-close'));
    await flush();

    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
    expect(analytics.trackTermsSignatureDeclined).not.toHaveBeenCalled();
    expect(toastWithCloseMock).not.toHaveBeenCalled();
  });

  it('closing during the pending signature step declines the terms — not a phantom transaction cancel', async () => {
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setPreludeSteps([{ label: 'Terms signature', kind: 'signature' }]);
      controls.setGateStatus('signature', { message: 'Sign the confirmation in your wallet.' });
      return new Promise(() => {}); // the sign prompt never answered
    };
    renderWithGate(gate, {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm: vi.fn(),
      analytics: { widgetName: 'savings', flow: 'supply', action: 'supply' }
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    toastWithCloseMock.mockClear();
    fireEvent.click(screen.getByTestId('transaction-modal-close'));
    await flush();

    // The decline is its own event, attributed to the gated flow; the
    // started↔completed pairing stays untouched.
    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
    expect(analytics.trackTermsSignatureDeclined).toHaveBeenCalledTimes(1);
    expect(analytics.trackTermsSignatureDeclined).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'abandoned', widgetName: 'savings', flow: 'supply' })
    );
    // The toast names the SIGN request — a transaction toast would misstate
    // what may still be sitting in the wallet.
    expect(toastWithCloseMock).toHaveBeenCalledTimes(1);
    const notice = renderLastToast();
    expect(notice.getByText('Signature request discarded')).toBeDefined();
  });

  it('launching another flow during the pending signature step declines the terms, not a cancel', async () => {
    const onConfirm = vi.fn();
    let firstCall = true;
    const gate: PreTransactionGate = ({ controls }) => {
      if (firstCall) {
        firstCall = false;
        controls.setPreludeSteps([{ label: 'Terms signature', kind: 'signature' }]);
        controls.setGateStatus('signature');
        return new Promise(() => {});
      }
      return { allow: true };
    };
    function RelaunchHarness() {
      const { launch } = useTransaction();
      return (
        <>
          <button
            data-testid="launch-a"
            onClick={() =>
              launch({
                title: 'Flow A',
                usdValue: 0,
                supportedChainIds: [1],
                onConfirm,
                analytics: { widgetName: 'savings', flow: 'supply', action: 'supply' }
              })
            }
          >
            a
          </button>
          <button
            data-testid="launch-b"
            onClick={() => launch({ title: 'Flow B', usdValue: 0, supportedChainIds: [1], onConfirm })}
          >
            b
          </button>
        </>
      );
    }
    render(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <TransactionProvider gate={gate}>
            <RelaunchHarness />
          </TransactionProvider>
        </I18nProvider>
      </StrictMode>
    );

    fireEvent.click(screen.getByTestId('launch-a'));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    fireEvent.click(screen.getByTestId('launch-b'));
    await flush();

    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
    expect(analytics.trackTermsSignatureDeclined).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'abandoned', widgetName: 'savings' })
    );
    // The new session is live and unpolluted.
    expect(screen.queryByText('Flow B')).not.toBeNull();
    expect(screen.queryByText('Terms signature')).toBeNull();
  });
});
