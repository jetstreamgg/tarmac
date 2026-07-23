import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TransactionContextValue, TxCallbacks } from './transactionContract';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionMinimize.test).
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

const analytics = vi.hoisted(() => ({
  trackWidgetReviewViewed: vi.fn(),
  trackTransactionStarted: vi.fn(),
  trackTransactionCompleted: vi.fn()
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => analytics
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn() })
}));

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

import { TransactionProvider, useTransaction } from './TransactionContext';

i18n.load('en', {});
i18n.activate('en');

const SUPPLY_CONFIG: TransactionConfig = {
  title: 'Supply USDS',
  steps: ['Supply'],
  analytics: { widgetName: 'savings', flow: 'supply' },
  onConfirm: () => {}
};

const STAKE_CONFIG: TransactionConfig = {
  title: 'Stake SKY',
  steps: ['Stake'],
  onConfirm: () => {}
};

function Harness({
  config,
  onReady
}: {
  config: TransactionConfig;
  onReady: (ctx: TransactionContextValue) => void;
}) {
  const ctx = useTransaction();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ctx.launch(config);
    onReady(ctx);
  }, [ctx, onReady, config]);
  return null;
}

// Mounts the provider, opens the modal, and advances to the transaction screen.
function renderFlow(config: TransactionConfig = SUPPLY_CONFIG): TransactionContextValue {
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

// Render the node the provider handed to toastWithClose (header + body notice).
const renderLastToast = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)![0] as (id: string) => ReactNode;
  return render(<I18nProvider i18n={i18n}>{renderFn('toast-id')}</I18nProvider>);
};

describe('TransactionModal abandon vs minimize (state-dependent dismissal)', () => {
  afterEach(() => vi.clearAllMocks());

  it('close during the wallet prompt (INITIALIZED) abandons: modal closes, cancelled is tracked, notice toast fires', () => {
    const ctx = renderFlow();
    const cb = cbOf(ctx);

    act(() => cb.onMutate()); // INITIALIZED — wallet prompt open, nothing on-chain
    analytics.trackTransactionCompleted.mockClear();
    toastWithCloseMock.mockClear();

    act(() => fireEvent.click(screen.getByTestId('transaction-modal-close')));

    // The session is torn down, not minimized.
    expect(screen.queryByText('Supply USDS')).toBeNull();
    expect(analytics.trackTransactionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ txStatus: 'cancelled' })
    );
    // The user is told the wallet may still show the discarded request — a
    // headed notice, not a bare sentence.
    expect(toastWithCloseMock).toHaveBeenCalled();
    const discarded = renderLastToast();
    expect(discarded.getByText('Transaction request discarded')).toBeDefined();
    expect(discarded.getByText('If your wallet still shows the request, reject it there.')).toBeDefined();

    // A fresh flow can start immediately.
    act(() => ctx.launch(STAKE_CONFIG));
    expect(screen.queryByText('Stake SKY')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeNull();
  });

  it('launching a new flow during the wallet prompt abandons the old session and starts the new one', () => {
    const ctx = renderFlow();
    const cb = cbOf(ctx);

    act(() => cb.onMutate()); // INITIALIZED
    analytics.trackTransactionCompleted.mockClear();

    act(() => ctx.launch(STAKE_CONFIG));

    // The NEW flow's modal shows on its first screen — not the old pending one.
    expect(screen.queryByText('Stake SKY')).not.toBeNull();
    expect(screen.queryByText('Supply USDS')).toBeNull();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeNull();
    // The abandoned session is tracked as cancelled.
    expect(analytics.trackTransactionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ txStatus: 'cancelled' })
    );
  });

  it('close after broadcast (LOADING) still minimizes — the transaction is not torn down', () => {
    const ctx = renderFlow();
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash')); // LOADING — broadcast
    analytics.trackTransactionCompleted.mockClear();

    act(() => fireEvent.click(screen.getByTestId('transaction-modal-close')));
    expect(screen.queryByText('Supply USDS')).toBeNull();
    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();

    // Restore proves the session survived.
    act(() => ctx.restore());
    expect(screen.queryByRole('button', { name: /processing/i })).not.toBeNull();
  });

  it('launching a new flow after broadcast restores the pending modal WITH an explanation toast', () => {
    const ctx = renderFlow();
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash')); // LOADING
    act(() => ctx.minimize());
    toastWithCloseMock.mockClear();

    act(() => ctx.launch(STAKE_CONFIG));

    // The pending modal comes back (not the new flow) and the user is told why.
    expect(screen.queryByText('Supply USDS')).not.toBeNull();
    expect(screen.queryByText('Stake SKY')).toBeNull();
    expect(toastWithCloseMock).toHaveBeenCalled();
    const blocked = renderLastToast();
    expect(blocked.getByText('Transaction in progress')).toBeDefined();
  });
});
