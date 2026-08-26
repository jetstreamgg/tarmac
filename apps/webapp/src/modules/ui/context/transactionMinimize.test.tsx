import { StrictMode, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionContextValue, TxCallbacks } from './transactionContract';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionStepProgression.test).
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

// Stable spies (hoisted) so assertions survive the provider's per-render reads.
const analytics = vi.hoisted(() => ({
  trackWidgetReviewViewed: vi.fn(),
  trackTransactionStarted: vi.fn(),
  trackTransactionCompleted: vi.fn()
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => analytics
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
}));

// Capture the styled toast surfaced while minimized (the app's toastWithClose).
const toastMock = vi.hoisted(() => ({ dismiss: vi.fn() }));
const toastWithCloseMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({
  toast: toastMock,
  toastWithClose: toastWithCloseMock
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

import { createPortal } from 'react-dom';
import { TransactionProvider, useTransaction, useEntrySlot } from './TransactionContext';
import type { TransactionConfig } from './transactionContract';

i18n.load('en', {});
i18n.activate('en');

const REVIEW_CONFIG: TransactionConfig = {
  title: 'Supply',
  usdValue: 0,
  steps: ['Supply'],
  onConfirm: () => {}
};

// Records mount/unmount — stands in for an `entry` body's in-flight engine hook,
// whose receipt-watcher must survive a minimize (unmounting it strands the tx).
const probe = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
function ProbeBody() {
  useEffect(() => {
    probe.mounts += 1;
    return () => {
      probe.unmounts += 1;
    };
  }, []);
  return <div>probe-body</div>;
}

// Like ProbeBody but it PORTALS its output into the entry slot (the SavingsModalForm
// pattern). The body-level effect stands in for the engine hook — it must survive the
// portal→inline switch that minimize triggers.
const portalProbe = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));
function PortalingHost() {
  useEffect(() => {
    portalProbe.mounts += 1;
    return () => {
      portalProbe.unmounts += 1;
    };
  }, []);
  const slot = useEntrySlot();
  const body = <div data-testid="portaling-host-body">body</div>;
  return slot ? createPortal(body, slot) : body;
}

// A backgroundContent host that portals its visible inputs into the dialog's entry
// slot (the savings pattern), falling back to inline when no slot is mounted.
function SlotProbe() {
  const slot = useEntrySlot();
  const inputs = <div data-testid="portaled-inputs">inputs</div>;
  return slot ? createPortal(inputs, slot) : inputs;
}

// Mimics SavingsModalForm's wiring: portals its body into the entry slot, and pushes
// a stable `onConfirm` (reading the latest engine `execute` from a ref) via
// updateModalContent. `execute` counts submissions so we can detect a duplicate.
const submit = vi.hoisted(() => ({ count: 0 }));
function WithdrawHost({ sessionId }: { sessionId: string }) {
  const { updateModalContent } = useTransaction();
  const slot = useEntrySlot();
  const [value] = useState('800');
  // Fresh closure every render (like the real engine's execute), so executeRef churns.
  const execute = () => {
    submit.count += 1;
  };
  const executeRef = useRef(execute);
  useEffect(() => {
    executeRef.current = execute;
  });
  const onConfirm = useCallback(() => executeRef.current(), []);
  useEffect(() => {
    updateModalContent(sessionId, { entry: { confirmDisabled: false }, onConfirm });
  }, [updateModalContent, sessionId, onConfirm]);
  const body = <div data-testid="withdraw-host">{value}</div>;
  return slot ? createPortal(body, slot) : body;
}

// Launches the given flow on mount and hands the whole context to the test (so it
// can drive engine callbacks AND minimize/restore the modal).
function Harness({
  config,
  onReady
}: {
  config: TransactionConfig;
  onReady: (ctx: TransactionContextValue) => void;
}) {
  const ctx = useTransaction();
  const started = useRef(false);
  // Report the LATEST context value on every render: engine callbacks are
  // bound to the session generation that rendered them, so tests must capture
  // them post-launch, the way real engines do.
  useEffect(() => {
    onReady(ctx);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ctx.launch(config);
  }, [ctx, config]);
  return null;
}

// Mounts the provider, opens the modal, advances to the transaction screen, and
// returns the context (its callbacks + minimize/restore are stable useCallbacks).
function renderFlow(config: TransactionConfig = REVIEW_CONFIG): TransactionContextValue {
  let ctx!: TransactionContextValue;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness config={config} onReady={c => (ctx = c)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  return ctx;
}

const cbOf = (ctx: TransactionContextValue): TxCallbacks => ctx.txCallbacks;

describe('TransactionModal minimize', () => {
  afterEach(() => vi.clearAllMocks());

  it('hides the modal without ending the transaction; restore reflects the live status', () => {
    const ctx = renderFlow();
    const cb = cbOf(ctx);

    // Drive the tx in-flight: wallet prompt → submitted.
    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    expect(screen.queryByText('Supply')).not.toBeNull();
    expect(screen.queryByText(/processing/i)).not.toBeNull();

    // Minimize: the modal view is gone, but the transaction is NOT torn down.
    act(() => ctx.minimize());
    expect(screen.queryByText('Supply')).toBeNull();

    // Restore: the modal returns on the transaction screen at its live status,
    // proving the tx kept running and its state survived minimize.
    act(() => ctx.restore());
    expect(screen.queryByText('Supply')).not.toBeNull();
    expect(screen.queryByText(/processing/i)).not.toBeNull();
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();

    // Resolving ends the session from either state — the outcome moves to a toast.
    act(() => cb.onSuccess('0xhash'));
    expect(screen.queryByText('Supply')).toBeNull();
  });

  it('does NOT emit a cancelled completion event when minimizing during the wallet prompt', () => {
    const ctx = renderFlow();
    const cb = cbOf(ctx);

    // Awaiting wallet confirmation (INITIALIZED) — the window where closing would
    // be tracked as a cancellation.
    act(() => cb.onMutate());
    analytics.trackTransactionCompleted.mockClear();

    act(() => ctx.minimize());

    // Minimize is not a cancel: no completion event of any kind fires.
    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
  });

  it('keeps backgroundContent (the in-flight hook host) mounted across minimize', () => {
    probe.mounts = 0;
    probe.unmounts = 0;
    // The hook host lives in backgroundContent (outside the Radix dialog); the
    // visible inputs would live in entry.content. Here we only assert the host's
    // lifetime — the mechanism every editable flow relies on.
    const ctx = renderFlow({
      title: 'Supply',
      usdValue: 0,
      steps: ['Supply'],
      entry: { content: <div>inputs</div>, confirmDisabled: false },
      backgroundContent: <ProbeBody />,
      onConfirm: () => {}
    });
    const cb = cbOf(ctx);

    // In-flight: the host is mounted (StrictMode may double-invoke effects, so
    // compare deltas rather than absolute counts).
    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    const unmountsBefore = probe.unmounts;
    const mountsBefore = probe.mounts;
    expect(probe.mounts).toBeGreaterThan(0);

    // Minimize must NOT unmount the host — that would kill the receipt-watcher.
    act(() => ctx.minimize());
    expect(probe.unmounts).toBe(unmountsBefore);

    // Restore re-shows the modal without remounting the host (the hook never died).
    act(() => ctx.restore());
    expect(probe.unmounts).toBe(unmountsBefore);
    expect(probe.mounts).toBe(mountsBefore);
  });

  it('minimizes (keeps the tx running) when the user dismisses an in-flight transaction', () => {
    const ctx = renderFlow();
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash')); // LOADING — in-flight
    expect(screen.queryByText(/processing/i)).not.toBeNull();

    // The close control minimizes mid-flight (the modal view goes away)…
    act(() => fireEvent.click(screen.getByTestId('transaction-modal-close')));
    expect(screen.queryByText('Supply')).toBeNull();

    // …but the transaction was not torn down — restore shows it still processing.
    act(() => ctx.restore());
    expect(screen.queryByText(/processing/i)).not.toBeNull();
  });

  it('resets to a fresh first screen when a new transaction is launched after a minimized one', () => {
    const ctx = renderFlow(); // launches + advances to the transaction screen
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    act(() => ctx.minimize());
    act(() => cb.onSuccess('0xhash')); // completed while minimized — session lingers

    // Reopen via a fresh launch (e.g. clicking the page's Supply button again).
    act(() => ctx.launch({ title: 'Supply', usdValue: 0, steps: ['Supply'], onConfirm: () => undefined }));

    // The modal is back on its first screen (Confirm), not the stale completed screen.
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /done/i })).toBeNull();
  });

  it('remounts the background host on a fresh launch so its inputs reset', () => {
    probe.mounts = 0;
    probe.unmounts = 0;
    const config: TransactionConfig = {
      title: 'Supply',
      usdValue: 0,
      steps: ['Supply'],
      entry: { confirmDisabled: false },
      backgroundContent: <ProbeBody />,
      onConfirm: () => undefined
    };
    const ctx = renderFlow(config);
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    act(() => ctx.minimize());
    act(() => cb.onSuccess('0xhash'));
    const mountsBefore = probe.mounts;

    act(() => ctx.launch(config)); // fresh launch → fresh host instance
    expect(probe.mounts).toBeGreaterThan(mountsBefore);
  });

  it('does not clobber an in-flight minimized tx on a new launch — it restores the pending modal', () => {
    probe.mounts = 0;
    probe.unmounts = 0;
    const config: TransactionConfig = {
      title: 'Supply',
      usdValue: 0,
      steps: ['Supply'],
      entry: { confirmDisabled: false },
      backgroundContent: <ProbeBody />,
      onConfirm: () => undefined
    };
    const ctx = renderFlow(config);
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash')); // LOADING — still in-flight
    act(() => ctx.minimize());
    const unmountsBefore = probe.unmounts;

    // User clicks the page's action button again while the tx is still running.
    act(() => ctx.launch(config));

    // The running host is NOT torn down (no remount) and the modal comes back on
    // its pending screen rather than a fresh entry.
    expect(probe.unmounts).toBe(unmountsBefore);
    expect(screen.queryByText(/processing/i)).not.toBeNull();
    expect(screen.queryByRole('button', { name: /confirm/i })).toBeNull();
  });

  it('keeps a PORTALING host body mounted across minimize (engine survives the portal switch)', () => {
    portalProbe.mounts = 0;
    portalProbe.unmounts = 0;
    const ctx = renderFlow({
      title: 'Supply',
      usdValue: 0,
      steps: ['Supply'],
      entry: { confirmDisabled: false },
      backgroundContent: <PortalingHost />,
      onConfirm: () => undefined
    });
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    const unmountsBefore = portalProbe.unmounts;

    act(() => ctx.minimize()); // slot disappears → host switches portal→inline
    expect(portalProbe.unmounts).toBe(unmountsBefore);

    act(() => cb.onSuccess('0xhash'));
    expect(portalProbe.unmounts).toBe(unmountsBefore);
  });

  it('does not re-submit the transaction when minimized (no duplicate execute)', () => {
    submit.count = 0;
    const sessionId = 'withdraw-session';
    const ctx = renderFlow({
      title: 'Withdraw',
      usdValue: 0,
      steps: ['Withdraw'],
      sessionId,
      entry: { confirmDisabled: false },
      backgroundContent: <WithdrawHost sessionId={sessionId} />,
      onConfirm: () => undefined
    });
    const cb = cbOf(ctx);

    // renderFlow already clicked Confirm → exactly one submission.
    expect(submit.count).toBe(1);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash')); // in-flight

    // Closing (minimize) must NOT fire a second submission.
    act(() => ctx.minimize());
    expect(submit.count).toBe(1);

    act(() => cb.onSuccess('0xhash'));
    expect(submit.count).toBe(1);
  });

  it('portals backgroundContent inputs into the dialog entry slot', () => {
    renderFlow({
      title: 'Supply',
      usdValue: 0,
      steps: ['Supply'],
      entry: { confirmDisabled: false },
      backgroundContent: <SlotProbe />,
      onConfirm: () => {}
    });

    // The host's inputs render inside the dialog (via the registered slot), not in
    // the hidden background host.
    const inputs = screen.getByTestId('portaled-inputs');
    expect(inputs.closest('[role="dialog"]')).not.toBeNull();
  });

  const TOAST_CONFIG: TransactionConfig = {
    title: 'Supply',
    usdValue: 0,
    steps: ['Supply'],
    subtitles: { success: 'Supplied!', error: 'Supply failed' },
    // Amount-aware title (what the savings host pushes) takes precedence over subtitles.
    toast: { success: '10,000.00 USDS supplied!' },
    onConfirm: () => {}
  };

  // Render the node the provider handed to toastWithClose.
  const renderLastToast = () => {
    const renderFn = toastWithCloseMock.mock.calls.at(-1)![0] as (id: string) => ReactNode;
    return render(<I18nProvider i18n={i18n}>{renderFn('toast-id')}</I18nProvider>);
  };

  it('surfaces a styled, amount-aware toast when the tx resolves while minimized', () => {
    const ctx = renderFlow(TOAST_CONFIG);
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    act(() => ctx.minimize());
    toastWithCloseMock.mockClear();

    act(() => cb.onSuccess('0xhash'));
    expect(toastWithCloseMock).toHaveBeenCalled();

    // The toast carries the amount-aware title (config.toast wins over subtitles).
    const { getByText } = renderLastToast();
    expect(getByText('10,000.00 USDS supplied!')).toBeDefined();
  });

  it('toasts exactly once when the tx resolves, minimized or not', () => {
    const ctx = renderFlow(TOAST_CONFIG);
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    // Not minimized — the modal is on screen, and hands the outcome over as it closes.
    toastWithCloseMock.mockClear();

    act(() => cb.onSuccess('0xhash'));
    expect(toastWithCloseMock).toHaveBeenCalledTimes(1);
    const { getByText } = renderLastToast();
    expect(getByText('10,000.00 USDS supplied!')).toBeDefined();
  });
});
