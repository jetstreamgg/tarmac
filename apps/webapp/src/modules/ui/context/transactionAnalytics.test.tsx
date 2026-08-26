import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TransactionContextValue, TxCallbacks } from './transactionContract';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, analytics, and error-reporting reads (mirrors transactionAbandon.test).
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
vi.mock('@/modules/sentry/reportError', () => ({ reportError: vi.fn() }));

// Shared call-order log: analytics, flow rotation, and consumer callbacks push here.
const callOrder = vi.hoisted(() => [] as string[]);
const analytics = vi.hoisted(() => ({
  trackWidgetReviewViewed: vi.fn(),
  trackTransactionStarted: vi.fn(),
  trackTransactionCompleted: vi.fn()
}));
const startNewFlowMock = vi.hoisted(() => vi.fn());
const getFlowIdMock = vi.hoisted(() => vi.fn(() => 'flow-live'));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => analytics
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: startNewFlowMock, getFlowId: getFlowIdMock })
}));

const toastMock = vi.hoisted(() => ({ dismiss: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({
  toast: toastMock,
  toastWithClose: vi.fn()
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
    onReady(ctx);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ctx.launch(config);
  }, [ctx, config]);
  return null;
}

// Mounts the provider, opens the modal, and clicks confirm.
function renderFlow(config: TransactionConfig): TransactionContextValue {
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

const baseConfig = (overrides: Partial<TransactionConfig> = {}): TransactionConfig => ({
  title: 'Supply USDS',
  steps: ['Supply'],
  usdValue: 100,
  analytics: { widgetName: 'savings', flow: 'supply', action: 'supply', data: { module: 'savings' } },
  onConfirm: () => {},
  ...overrides
});

// EIP-1193 user rejection, nested the way viem wraps it
const userRejectionError = () =>
  Object.assign(new Error('Transaction failed'), {
    cause: { code: 4001, message: 'User rejected the request. Details: 0xdeadbeef calldata' }
  });

const lastCompletedArgs = () =>
  analytics.trackTransactionCompleted.mock.calls.at(-1)?.[0] as Record<string, unknown>;

describe('TransactionContext analytics (modal path)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
  });

  it('records a wallet rejection as cancelled with bounded classification (D1), never the raw message', () => {
    const ctx = renderFlow(baseConfig());
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onError(userRejectionError()));

    const args = lastCompletedArgs();
    expect(args).toMatchObject({
      widgetName: 'savings',
      txStatus: 'cancelled',
      data: expect.objectContaining({
        module: 'savings',
        error_kind: 'user_rejected',
        is_user_rejection: true
      })
    });
    expect(JSON.stringify(args)).not.toContain('0xdeadbeef');
  });

  it('records an on-chain revert as error with classification props and no error_context (G2)', () => {
    const ctx = renderFlow(baseConfig());
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    act(() =>
      cb.onError(
        Object.assign(new Error('execution reverted: secret calldata 0xbeef'), {
          name: 'ContractFunctionExecutionError'
        }),
        '0xhash'
      )
    );

    const args = lastCompletedArgs();
    expect(args).toMatchObject({
      txStatus: 'error',
      txHash: '0xhash',
      data: expect.objectContaining({ error_kind: 'reverted', is_user_rejection: false })
    });
    expect(args).not.toHaveProperty('errorContext');
    expect(JSON.stringify(args)).not.toContain('secret calldata');
  });

  it('rotates the flow AFTER the consumer onSuccess, so its follow-up joins this flow', () => {
    const onSuccess = vi.fn(() => callOrder.push('consumer_onSuccess'));
    startNewFlowMock.mockImplementation(() => callOrder.push('startNewFlow'));
    analytics.trackTransactionCompleted.mockImplementation(() => callOrder.push('track_completed'));

    const ctx = renderFlow(baseConfig({ onSuccess }));
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    act(() => cb.onSuccess('0xhash'));

    expect(callOrder).toEqual(['track_completed', 'consumer_onSuccess', 'startNewFlow']);
  });

  it('rotates the flow AFTER the consumer onError as well', () => {
    const onError = vi.fn(() => callOrder.push('consumer_onError'));
    startNewFlowMock.mockImplementation(() => callOrder.push('startNewFlow'));
    analytics.trackTransactionCompleted.mockImplementation(() => callOrder.push('track_completed'));

    const ctx = renderFlow(baseConfig({ onError }));
    const cb = cbOf(ctx);

    act(() => cb.onMutate());
    act(() => cb.onStart('0xhash'));
    act(() => cb.onError(new Error('boom'), '0xhash'));

    expect(callOrder).toEqual(['track_completed', 'consumer_onError', 'startNewFlow']);
  });
});

describe('TransactionContext flow_id latching', () => {
  afterEach(() => {
    vi.clearAllMocks();
    getFlowIdMock.mockReturnValue('flow-live');
  });

  it('keeps started/completed on the flow latched at launch even if navigation rotates the live id mid-transaction', () => {
    getFlowIdMock.mockReturnValue('flow-A');
    const ctx = renderFlow(baseConfig());
    const cb = cbOf(ctx);

    act(() => cb.onMutate({ functionName: 'deposit' }));
    // User minimizes and navigates while the tx mines: the subscriber rotates the live flow.
    getFlowIdMock.mockReturnValue('flow-B');
    act(() => cb.onStart('0xhash'));
    act(() => cb.onSuccess('0xhash'));

    expect(analytics.trackTransactionStarted).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: 'flow-A' })
    );
    expect(analytics.trackTransactionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ txStatus: 'success', flowId: 'flow-A' })
    );
  });

  it('stamps review_viewed with the same latched flow id', () => {
    getFlowIdMock.mockReturnValue('flow-A');
    renderFlow(baseConfig());

    expect(analytics.trackWidgetReviewViewed).toHaveBeenCalledWith(
      expect.objectContaining({ flowId: 'flow-A' })
    );
  });

  it('re-latches per launch: a second transaction carries the rotated flow id', () => {
    getFlowIdMock.mockReturnValue('flow-A');
    // Live holder: launch() advances sessionGen, so the callbacks must be re-read.
    const holder: { ctx?: TransactionContextValue } = {};
    render(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <TransactionProvider>
            <Harness config={baseConfig()} onReady={c => (holder.ctx = c)} />
          </TransactionProvider>
        </I18nProvider>
      </StrictMode>
    );
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    act(() => holder.ctx!.txCallbacks.onMutate({ functionName: 'deposit' }));
    act(() => holder.ctx!.txCallbacks.onSuccess('0xhash'));

    getFlowIdMock.mockReturnValue('flow-C');
    act(() => holder.ctx!.launch(baseConfig()));
    act(() => holder.ctx!.txCallbacks.onMutate({ functionName: 'deposit' }));

    expect(analytics.trackTransactionStarted).toHaveBeenLastCalledWith(
      expect.objectContaining({ flowId: 'flow-C' })
    );
  });
});

describe('TransactionContext review_viewed timing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // Review-first flows (no entry) open on the review screen: launch IS the view.
  it('emits review_viewed at launch for a review-first config', () => {
    renderFlow(baseConfig());
    expect(analytics.trackWidgetReviewViewed).toHaveBeenCalledTimes(1);
    expect(analytics.trackWidgetReviewViewed).toHaveBeenCalledWith({
      widgetName: 'savings',
      chainId: 1,
      flow: 'supply',
      action: 'supply',
      data: { module: 'savings' },
      flowId: 'flow-live'
    });
  });

  it('does NOT emit review_viewed at launch for an entry-first config', () => {
    let ctx!: TransactionContextValue;
    render(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <TransactionProvider>
            <Harness
              config={baseConfig({
                sessionId: 's1',
                entry: { confirmLabel: 'Review', confirmDisabled: false },
                transactionContent: <span>review body</span>
              })}
              onReady={c => (ctx = c)}
            />
          </TransactionProvider>
        </I18nProvider>
      </StrictMode>
    );
    void ctx;
    expect(analytics.trackWidgetReviewViewed).not.toHaveBeenCalled();
  });

  it('emits review_viewed at the entry→review transition, reading the live-merged analytics', () => {
    let ctx!: TransactionContextValue;
    render(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <TransactionProvider>
            <Harness
              config={baseConfig({
                sessionId: 's1',
                entry: { confirmLabel: 'Review', confirmDisabled: false },
                transactionContent: <span>review body</span>
              })}
              onReady={c => (ctx = c)}
            />
          </TransactionProvider>
        </I18nProvider>
      </StrictMode>
    );

    // The editable body live-merges an updated blob before the user advances.
    act(() =>
      ctx.updateModalContent('s1', {
        analytics: { widgetName: 'savings', flow: 'withdraw', action: 'withdraw', data: { amount: -5 } }
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /review/i }));

    expect(analytics.trackWidgetReviewViewed).toHaveBeenCalledTimes(1);
    expect(analytics.trackWidgetReviewViewed).toHaveBeenCalledWith({
      widgetName: 'savings',
      chainId: 1,
      flow: 'withdraw',
      action: 'withdraw',
      data: { amount: -5 },
      flowId: 'flow-live'
    });
  });

  it('emits no review_viewed at all for an entry-only flow (claims parity: no review screen exists)', () => {
    let ctx!: TransactionContextValue;
    render(
      <StrictMode>
        <I18nProvider i18n={i18n}>
          <TransactionProvider>
            <Harness
              config={baseConfig({
                sessionId: 's1',
                entry: { confirmLabel: 'Claim', confirmDisabled: false }
                // no transactionContent → no review stage
              })}
              onReady={c => (ctx = c)}
            />
          </TransactionProvider>
        </I18nProvider>
      </StrictMode>
    );
    void ctx;
    fireEvent.click(screen.getByRole('button', { name: /claim/i }));
    expect(analytics.trackWidgetReviewViewed).not.toHaveBeenCalled();
  });

  it('discriminates the approve leg: a sequential approve mutate reports action approve, the main leg the module action', () => {
    const ctx = renderFlow(baseConfig());
    const cb = cbOf(ctx);

    act(() => cb.onMutate({ functionName: 'approve' }));
    act(() => cb.onStart('0xapprove'));
    act(() => cb.onMutate({ functionName: 'deposit' }));

    const actions = analytics.trackTransactionStarted.mock.calls.map(([args]) => args.action);
    expect(actions).toEqual(['approve', 'supply']);
  });

  it('keeps the module action when no leg variables arrive (batch sendCalls, manual pendle calls)', () => {
    const ctx = renderFlow(baseConfig());
    const cb = cbOf(ctx);

    act(() => cb.onMutate());

    expect(analytics.trackTransactionStarted).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'supply' })
    );
  });
});
