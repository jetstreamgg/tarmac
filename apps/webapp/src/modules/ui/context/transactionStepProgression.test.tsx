import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from './transactionContract';

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

// Launches a 2-step flow on mount and hands the engine callbacks to the test.
function Harness({ steps, onReady }: { steps: string[]; onReady: (cb: TxCallbacks) => void }) {
  const { launch, txCallbacks } = useTransaction();
  const started = useRef(false);
  // Report the LATEST callbacks on every render: they are bound to the session
  // generation that rendered them, so tests must capture them post-launch, the
  // way real engines do.
  useEffect(() => {
    onReady(txCallbacks);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch({ title: 'Supply', steps, onConfirm: () => {} });
  }, [launch, steps]);
  return null;
}

// Mounts the provider under StrictMode (mirrors the app — the impure-updater
// double-invoke only surfaces here), opens the modal, advances to the
// transaction screen, and returns the engine callbacks.
function renderFlow(steps: string[]): TxCallbacks {
  let cb!: TxCallbacks;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness steps={steps} onReady={c => (cb = c)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  return cb;
}

// A step row shows its NUMBER until it completes, when the number is replaced by
// a checkmark. So a visible number == that step is not yet completed.
const stepIncomplete = (n: number) => expect(screen.queryByText(String(n))).not.toBeNull();
const stepComplete = (n: number) => expect(screen.queryByText(String(n))).toBeNull();
const noDone = () => expect(screen.queryByRole('button', { name: /done/i })).toBeNull();
const hasDone = () => expect(screen.queryByRole('button', { name: /done/i })).not.toBeNull();

describe('TransactionModal step progression', () => {
  beforeEach(() => {
    i18n.activate('en');
  });
  afterEach(() => vi.clearAllMocks());

  it('sequential flow: completes steps one at a time; Done only after the final success', () => {
    const cb = renderFlow(['Approve', 'Supply']);

    // Step 1 (approve) starts — nothing completed yet, no Done.
    act(() => cb.onMutate());
    act(() => cb.onStart('0xapprove'));
    stepIncomplete(1);
    stepIncomplete(2);
    noDone();

    // Step 2 (supply) starts after the approve mined. THE regression guard:
    // step 1 completes, step 2 is still pending (not both), and still no Done.
    act(() => cb.onMutate());
    stepComplete(1);
    stepIncomplete(2);
    noDone();

    // Final success → both complete + Done.
    act(() => cb.onStart('0xsupply'));
    act(() => cb.onSuccess('0xsupply'));
    stepComplete(1);
    stepComplete(2);
    hasDone();
  });

  it('batch flow: a single mutation never advances steps until the bundle succeeds', () => {
    const cb = renderFlow(['Approve', 'Supply']);

    // One mutation covers the whole bundle — neither step completes mid-flight.
    act(() => cb.onMutate());
    act(() => cb.onStart('0xbundle'));
    stepIncomplete(1);
    stepIncomplete(2);
    noDone();

    // Bundle mined → both complete at once + Done.
    act(() => cb.onSuccess('0xbundle'));
    stepComplete(1);
    stepComplete(2);
    hasDone();
  });
});
