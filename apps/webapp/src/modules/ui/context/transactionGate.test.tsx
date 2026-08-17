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
    renderWithGate(gate, { title: 'Supply', onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    // No flush between the click and this assertion: the engine contract
    // requires the write to start synchronously from the user's confirm.
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(gate).toHaveBeenCalledWith({ trigger: 'confirm' });
  });

  it('an async allow defers onConfirm to the verdict, then runs it', async () => {
    const onConfirm = vi.fn();
    renderWithGate(async () => ({ allow: true }), { title: 'Supply', onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).not.toHaveBeenCalled();

    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a denial never runs onConfirm', async () => {
    const onConfirm = vi.fn();
    renderWithGate(() => ({ allow: false }), { title: 'Supply', onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('a rejected verdict counts as a denial', async () => {
    const onConfirm = vi.fn();
    renderWithGate(() => Promise.reject(new Error('gate exploded')), { title: 'Supply', onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('an allow resolving after the session closed is dropped (generation guard)', async () => {
    const onConfirm = vi.fn();
    let resolveVerdict!: (v: { allow: boolean }) => void;
    const gate: PreTransactionGate = () => new Promise(resolve => (resolveVerdict = resolve));
    renderWithGate(gate, { title: 'Supply', onConfirm });

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
    const cb = renderWithGate(gate, { title: 'Supply', onConfirm });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => cb.onMutate());
    act(() => cb.onError(new Error('rejected in wallet')));

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(gate).toHaveBeenLastCalledWith({ trigger: 'retry' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    // Denied: still on the failure screen, retry still available.
    expect(screen.getByRole('button', { name: /retry/i })).not.toBeNull();
  });

  it("the entry's secondary CTA is gated with its own trigger", () => {
    const onConfirm = vi.fn();
    const onSecondaryConfirm = vi.fn();
    const gate = vi.fn(() => ({ allow: true }));
    renderWithGate(gate, {
      title: 'Claim',
      entry: { content: <div />, secondaryConfirmLabel: 'Claim only' },
      onConfirm,
      onSecondaryConfirm
    });

    fireEvent.click(screen.getByRole('button', { name: /claim only/i }));
    expect(gate).toHaveBeenCalledWith({ trigger: 'secondaryConfirm' });
    expect(onSecondaryConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
