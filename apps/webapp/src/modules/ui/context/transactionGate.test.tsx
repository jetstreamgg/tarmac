import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';
import type { PreTransactionGate } from './preTransactionGate';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads.
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

describe('TransactionProvider pre-transaction gate', () => {
  beforeEach(() => {
    i18n.activate('en');
  });
  afterEach(() => vi.clearAllMocks());

  it('a synchronous allow runs onConfirm in the same tick as the confirm click', () => {
    const onConfirm = vi.fn();
    const gate = vi.fn(() => ({ allow: true }));
    renderWithGate(gate, { title: 'Supply', usdValue: 0, onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    // No flush between the click and this assertion: the engine contract
    // requires the write to start synchronously from the user's confirm.
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(gate).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'confirm' }));
  });

  it('an async allow defers onConfirm to the verdict, then runs it', async () => {
    const onConfirm = vi.fn();
    renderWithGate(async () => ({ allow: true }), { title: 'Supply', usdValue: 0, onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a denial never runs onConfirm', async () => {
    const onConfirm = vi.fn();
    renderWithGate(() => ({ allow: false }), { title: 'Supply', usdValue: 0, onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a rejected verdict counts as a denial', async () => {
    const onConfirm = vi.fn();
    renderWithGate(() => Promise.reject(new Error('gate exploded')), {
      title: 'Supply',
      usdValue: 0,
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
    renderWithGate(gate, { title: 'Supply', usdValue: 0, onConfirm });

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
    const cb = renderWithGate(gate, { title: 'Supply', usdValue: 0, onConfirm });

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
    renderWithGate(gate, { title: 'Supply', usdValue: 0, onConfirm });

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
      controls.setGateStatus('initialized');
      return new Promise(resolve => {
        resolveSigned = (ok: boolean) => {
          if (!ok) controls.setGateStatus('error');
          resolve({ allow: ok });
        };
      });
    };
    const cb = renderWithGate(gate, { title: 'Supply', usdValue: 0, onConfirm, steps: ['Supply USDS'] });

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
      controls.setGateStatus('initialized');
      return Promise.resolve({ allow: false }).then(v => {
        controls.setGateStatus('error');
        return v;
      });
    };
    renderWithGate(gate, { title: 'Claim', usdValue: 0, onConfirm });

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
      controls.setGateStatus('initialized', {
        message: 'Sign the confirmation in your wallet.',
        subtitle: 'Signature needed to continue.'
      });
      return new Promise(() => {});
    };
    renderWithGate(gate, {
      title: 'Supply',
      usdValue: 0,
      onConfirm: vi.fn(),
      subtitles: { pending: 'Supplying your tokens...' },
      steps: ['Supply USDS']
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    expect(screen.getByText('Sign the confirmation in your wallet.')).not.toBeNull();
    expect(screen.getByText('Signature needed to continue.')).not.toBeNull();
    // The flow's own pending copy stays hidden while the gate copy is set.
    expect(screen.queryByText('Supplying your tokens...')).toBeNull();
    expect(screen.queryByText('Confirm this transaction in your wallet.')).toBeNull();
  });

  it("the engine's first onMutate clears the gate copy — the flow's narration takes over", async () => {
    let resolveSigned!: () => void;
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setPreludeSteps([{ label: 'Terms signature', kind: 'signature' }]);
      controls.setGateStatus('initialized', {
        message: 'Sign the confirmation in your wallet.',
        subtitle: 'Signature needed to continue.'
      });
      return new Promise(resolve => (resolveSigned = () => resolve({ allow: true })));
    };
    const cb = renderWithGate(gate, {
      title: 'Supply',
      usdValue: 0,
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
        controls.setGateStatus('initialized');
        return new Promise(() => {}); // the wallet prompt never answered
      }
      return { allow: true };
    };

    function RelaunchHarness() {
      const { launch } = useTransaction();
      return (
        <>
          <button data-testid="launch-a" onClick={() => launch({ title: 'Flow A', usdValue: 0, onConfirm })}>
            a
          </button>
          <button
            data-testid="launch-b"
            onClick={() => launch({ title: 'Flow B', usdValue: 0, onConfirm, steps: ['Supply USDS'] })}
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
      controls.setGateStatus('initialized');
      return Promise.resolve({ allow: false }).then(v => {
        controls.setGateStatus('error');
        return v;
      });
    });
    renderWithGate(gate as unknown as PreTransactionGate, {
      title: 'Supply',
      usdValue: 0,
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

  it("the entry's secondary CTA is gated with its own trigger", () => {
    const onConfirm = vi.fn();
    const onSecondaryConfirm = vi.fn();
    const gate = vi.fn(() => ({ allow: true }));
    renderWithGate(gate, {
      title: 'Claim',
      usdValue: 0,
      entry: { content: <div />, secondaryConfirmLabel: 'Claim only' },
      onConfirm,
      onSecondaryConfirm
    });

    fireEvent.click(screen.getByRole('button', { name: /claim only/i }));
    expect(gate).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'secondaryConfirm' }));
    expect(onSecondaryConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
