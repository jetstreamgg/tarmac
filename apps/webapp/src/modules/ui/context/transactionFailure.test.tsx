import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from './transactionContract';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';

// Flip per-test to exercise the bundled failure treatment (vi.mock factories
// are hoisted, so the flags live in a hoisted holder).
const batch = vi.hoisted(() => ({ enabled: false, supported: false }));

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, analytics, and error-reporting reads.
vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => 1,
  useConnection: () => ({ address: '0x0000000000000000000000000000000000000001', isConnected: true })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useIsBatchSupported: () => ({ data: batch.supported })
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [batch.enabled, () => {}] }));
vi.mock('@/modules/sentry/reportError', () => ({ reportError: vi.fn() }));
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

const supplySteps: TransactionStep[] = [
  { label: 'Approve', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been approved." },
  { label: 'Supply', tokenSymbol: 'USDS' }
];

function Harness({
  steps,
  onConfirm,
  onReady
}: {
  steps: TransactionStep[];
  onConfirm: () => void;
  onReady: (cb: TxCallbacks) => void;
}) {
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
    launch({ title: 'Supply USDS', steps, onConfirm });
  }, [launch, steps, onConfirm]);
  return null;
}

// Opens the modal, advances to the transaction screen, and fails the first step.
function renderFailedFlow(steps: TransactionStep[], onConfirm: () => void = () => {}): TxCallbacks {
  let cb!: TxCallbacks;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness steps={steps} onConfirm={onConfirm} onReady={c => (cb = c)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  act(() => cb.onMutate());
  act(() => cb.onStart('0xapprove'));
  act(() => cb.onError(new Error('boom'), '0xapprove'));
  return cb;
}

describe('TransactionModal failure & recovery', () => {
  beforeEach(() => {
    i18n.activate('en');
    batch.enabled = false;
    batch.supported = false;
  });
  afterEach(() => vi.clearAllMocks());

  it('standard flow: retitles the failed step with the rollback copy and an inline Try again, replacing the footer', () => {
    renderFailedFlow(supplySteps);

    // Inline treatment on the failed step row.
    expect(screen.getByText('Approve failed')).toBeDefined();
    expect(
      screen.getByText("The network rolled back your transaction. The USDS hasn't been approved.")
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();

    // The later step stays as a plain upcoming row.
    expect(screen.getByText('Supply')).toBeDefined();

    // The old bottom treatment is replaced by the inline one.
    expect(screen.queryByText('Transaction failed. Please try again.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('standard flow: Try again re-runs the flow and the failure treatment clears once it restarts', () => {
    const onConfirm = vi.fn();
    const cb = renderFailedFlow(supplySteps, onConfirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onConfirm).toHaveBeenCalledTimes(2);

    // The engine restarts from the failed step: back to the plain step list.
    act(() => cb.onMutate());
    expect(screen.queryByText('Approve failed')).toBeNull();
    expect(screen.getByText('Approve')).toBeDefined();
  });

  it('bundled flow: collapses to a "Transaction failed" slot with the retry pill in the next slot', () => {
    batch.enabled = true;
    batch.supported = true;
    renderFailedFlow(supplySteps);

    expect(screen.getByText('Transaction failed')).toBeDefined();
    expect(
      screen.getByText(
        'The network rolled back your transaction. Try again and confirm bundled transaction in your wallet.'
      )
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.getByText('Bundled')).toBeDefined();

    // The flow's own steps are collapsed away while the failure is shown.
    expect(screen.queryByText('Approve')).toBeNull();
    expect(screen.queryByText('Supply')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
