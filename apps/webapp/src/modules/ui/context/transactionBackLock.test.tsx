import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from './transactionContract';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';

// APP-448 — Back on the failure screen. Before a step has mined, Back returns
// the session to an editable, live first screen (status IDLE). Once a step has
// mined, the engine's paused run must resume, so Back is withheld and Retry is
// the only way on.

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, analytics, and error-reporting reads.
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
  { label: 'Approve', tokenSymbol: 'USDS' },
  { label: 'Supply', tokenSymbol: 'USDS' }
];

function Harness({ steps, onReady }: { steps?: TransactionStep[]; onReady: (cb: TxCallbacks) => void }) {
  const { launch, txCallbacks, txStatus } = useTransaction();
  const started = useRef(false);
  useEffect(() => {
    onReady(txCallbacks);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch({ title: 'Supply USDS', usdValue: 0, supportedChainIds: [1], steps, onConfirm: () => {} });
  }, [launch, steps]);
  return <span data-testid="tx-status">{txStatus}</span>;
}

// Opens the modal and confirms, handing back the engine callbacks.
function renderConfirmedFlow(steps?: TransactionStep[]): TxCallbacks {
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

const status = () => screen.getByTestId('tx-status').textContent;
const headerBack = () => screen.getByTestId('transaction-modal-back') as HTMLButtonElement;
// The header arrow is also named "Back" — the footer button is the one without the test id.
const footerBacks = () =>
  screen
    .queryAllByRole('button', { name: 'Back' })
    .filter(b => b.dataset.testid !== 'transaction-modal-back');

describe('TransactionModal — Back after a failure (APP-448)', () => {
  beforeEach(() => i18n.activate('en'));
  afterEach(() => vi.clearAllMocks());

  it('single-step failure: Back returns to a live first screen with the status back at IDLE', () => {
    const cb = renderConfirmedFlow();
    act(() => cb.onMutate());
    act(() => cb.onError(new Error('User rejected the request'), ''));
    expect(status()).toBe('error');

    expect(footerBacks()).toHaveLength(1);
    fireEvent.click(footerBacks()[0]);

    expect(screen.getByRole('button', { name: /confirm/i })).toBeDefined();
    expect(status()).toBe('idle');
  });

  it('multi-step failure before any step mined: the header arrow still goes back', () => {
    const cb = renderConfirmedFlow(supplySteps);
    act(() => cb.onMutate());
    act(() => cb.onError(new Error('User rejected the request'), ''));

    expect(headerBack().disabled).toBe(false);
    fireEvent.click(headerBack());

    expect(screen.getByRole('button', { name: /confirm/i })).toBeDefined();
    expect(status()).toBe('idle');
  });

  it('multi-step failure after a mined step: Back is withheld, Try again remains', () => {
    const cb = renderConfirmedFlow(supplySteps);
    act(() => cb.onMutate());
    act(() => cb.onStart('0xapprove'));
    // The approve mined and the engine handed the supply to the wallet, which rejected it.
    act(() => cb.onMutate());
    act(() => cb.onError(new Error('User rejected the request'), ''));
    expect(status()).toBe('error');

    expect(headerBack().disabled).toBe(true);
    expect(footerBacks()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('a step mined on an earlier attempt still withholds Back after a retried failure', () => {
    const cb = renderConfirmedFlow(supplySteps);
    act(() => cb.onMutate());
    act(() => cb.onStart('0xapprove'));
    act(() => cb.onMutate());
    act(() => cb.onError(new Error('User rejected the request'), ''));

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    act(() => cb.onMutate());
    act(() => cb.onError(new Error('User rejected the request'), ''));

    expect(headerBack().disabled).toBe(true);
  });
});

// Which step the list points at once Retry resumes. The engine re-dispatches the
// leg it stopped on, so a modal that reset to step 0 named the approve while the
// wallet was holding the supply.
describe('TransactionModal — the step list after Retry', () => {
  beforeEach(() => i18n.activate('en'));
  afterEach(() => vi.clearAllMocks());

  // A step row shows its NUMBER until it completes, when a checkmark replaces it.
  const stepCompleted = (n: number) => expect(screen.queryByText(String(n))).toBeNull();
  const stepNotCompleted = (n: number) => expect(screen.queryByText(String(n))).not.toBeNull();

  it('after a mined approve, Retry keeps the supply as the active step', () => {
    const cb = renderConfirmedFlow(supplySteps);
    act(() => cb.onMutate()); // approve → wallet
    act(() => cb.onStart('0xapprove')); // approve broadcast
    act(() => cb.onMutate()); // approve mined, supply → wallet
    act(() => cb.onError(new Error('reverted'), '0xsupply'));

    // The failure names the supply, and the approve stays completed.
    expect(screen.getByText('Supply failed')).toBeDefined();
    stepCompleted(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    act(() => cb.onMutate()); // the engine resumes the SUPPLY

    // Still the supply in flight: the approve keeps its checkmark and the
    // failure treatment is gone. A reset to step 0 would light the approve up
    // again and re-number the rows.
    stepCompleted(1);
    stepNotCompleted(2);
    expect(screen.queryByText('Approve failed')).toBeNull();
    expect(screen.getByText('Supply')).toBeDefined();
  });

  it('with nothing mined, Retry still restarts the list at the first step', () => {
    const cb = renderConfirmedFlow(supplySteps);
    act(() => cb.onMutate()); // approve → wallet
    act(() => cb.onError(new Error('User rejected the request'), ''));
    expect(screen.getByText('Approve failed')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    act(() => cb.onMutate());

    // The run restarts from the approve, so neither step is completed.
    stepNotCompleted(1);
    stepNotCompleted(2);
    expect(screen.getByText('Approve')).toBeDefined();
  });
});
