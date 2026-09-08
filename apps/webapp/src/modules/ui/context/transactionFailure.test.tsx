import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from './transactionContract';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';
import { assignSequentialWrites } from '@/modules/ui/components/transactionStepsModel';

// Flip per-test to exercise the bundled failure treatment (vi.mock factories
// are hoisted, so the flags live in a hoisted holder).
const batch = vi.hoisted(() => ({ enabled: false, supported: false }));

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, analytics, and error-reporting reads.
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
    launch({ title: 'Supply USDS', usdValue: 0, supportedChainIds: [1], steps, onConfirm });
  }, [launch, steps, onConfirm]);
  return null;
}

// Opens the modal, advances to the transaction screen, and fails the first step.
function renderFailedFlow(
  steps: TransactionStep[],
  onConfirm: () => void = () => {},
  error: Error = new Error('boom')
): TxCallbacks {
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
  act(() => cb.onError(error, '0xapprove'));
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

  it('single-step flow: grows the step list on failure so the failed row tells the error, replacing the footer', () => {
    // A lone step has no list in flight (the chip carries the state) and, since
    // the status subtitles went (design QA, Sep 2026), nothing else names what
    // failed — so the failure renders as the same DS Steps row multi-step flows get.
    renderFailedFlow([
      { label: 'Supply', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been supplied." }
    ]);

    expect(screen.getByText('Supply failed')).toBeDefined();
    expect(
      screen.getByText("The network rolled back your transaction. The USDS hasn't been supplied.")
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(screen.getByTestId('transaction-status-badge').textContent).toContain('Transaction failed');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('a wallet Reject reads as declined — no rollback sentence, no consequence, chip says so', () => {
    // EIP-1193 4001 shape, what viem hands back when the user presses Reject.
    renderFailedFlow(
      supplySteps,
      () => {},
      Object.assign(new Error('User rejected the request.'), { code: 4001 })
    );

    expect(screen.getByText('Approve declined')).toBeDefined();
    expect(screen.getByText('You declined the request in your wallet. Nothing was sent.')).toBeDefined();
    expect(screen.queryByText(/rolled back/)).toBeNull();
    expect(screen.queryByText(/hasn't been approved/)).toBeNull();
    expect(screen.getByTestId('transaction-status-badge').textContent).toContain('Request declined');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('grouped writes: failing the multicall fails every row of it, with a single Try again', () => {
    // Approve mined (write 0), then the multicall (write 1) reverts.
    let cb!: TxCallbacks;
    const steps = assignSequentialWrites(
      [
        { label: 'Approve', tokenSymbol: 'SKY' },
        { label: 'Stake', tokenSymbol: 'SKY', failureDetail: "The SKY hasn't been staked." },
        { label: 'Select reward', tokenSymbol: 'SPK' },
        'Delegate voting power'
      ],
      1
    );
    render(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <TransactionProvider>
            <Harness steps={steps} onConfirm={() => {}} onReady={c => (cb = c)} />
          </TransactionProvider>
        </I18nProvider>
      </StrictMode>
    );
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    act(() => cb.onMutate());
    act(() => cb.onStart('0xapprove'));
    act(() => cb.onMutate());
    act(() => cb.onStart('0xmulticall'));
    act(() => cb.onError(new Error('boom'), '0xmulticall'));

    expect(screen.getByText('Approve')).toBeDefined();
    expect(screen.getByText('Stake failed')).toBeDefined();
    expect(screen.getByText('Select reward failed')).toBeDefined();
    expect(screen.getByText('Delegate voting power failed')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1);
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

    // Once for the collapsed step row, once for the header chip (Figma 2800:91683).
    expect(screen.getAllByText('Transaction failed')).toHaveLength(2);
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
