// A send the wallet answered with an error viem can't read may have gone out: never "failed", never a Retry.
import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';
import { walletSendError } from '@/test/walletSendError';

// Set per test to run inside the Safe App.
const wallet = vi.hoisted(() => ({ connector: undefined as { id: string } | undefined }));

// Same stubs as transactionFailure.test.tsx: the real provider and modal, inert chain/wallet.
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    handleSwitchChain: vi.fn(),
    isSwitchPending: false,
    switchVariables: undefined,
    canSwitchChain: true
  })
}));
vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => 1,
  useChains: () => [{ id: 1, name: 'Ethereum' }],
  useConnection: () => ({
    address: '0x0000000000000000000000000000000000000001',
    isConnected: true,
    connector: wallet.connector
  })
}));
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useIsBatchSupported: () => ({ data: false })
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [false, () => {}] }));
vi.mock('@/modules/sentry/reportError', () => ({ reportError: vi.fn() }));
const analytics = vi.hoisted(() => ({
  trackWidgetReviewViewed: vi.fn(),
  trackTransactionStarted: vi.fn(),
  trackTransactionCompleted: vi.fn()
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({ useAppAnalytics: () => analytics }));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
}));
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
import { reportError } from '@/modules/sentry/reportError';
import { queryClient } from '@/lib/queryClient';
import { SAFE_CONNECTOR_ID } from '@/hooks/shared/constants';

i18n.load('en', {});
i18n.activate('en');

const CONFIG: TransactionConfig = {
  title: 'Supply USDS',
  usdValue: 0,
  supportedChainIds: [1],
  steps: [
    { label: 'Approve', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been approved." },
    { label: 'Supply', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been supplied." }
  ],
  analytics: { widgetName: 'savings', flow: 'supply', action: 'supply', data: { module: 'savings' } },
  onConfirm: () => {}
};

function Harness({ onReady }: { onReady: (cb: TxCallbacks) => void }) {
  const { launch, txCallbacks, failureMayStillMine } = useTransaction();
  const started = useRef(false);
  useEffect(() => {
    onReady(txCallbacks);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch(CONFIG);
  }, [launch]);
  return <output data-testid="failure-may-still-mine">{String(failureMayStillMine)}</output>;
}

function renderFlow() {
  let cb!: TxCallbacks;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness onReady={c => (cb = c)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  return () => cb;
}

const retryButtons = () => screen.queryAllByRole('button', { name: /^(retry|try again)$/i });
const failureMayStillMine = () => screen.getByTestId('failure-may-still-mine').textContent;
const lastCompleted = () =>
  analytics.trackTransactionCompleted.mock.calls.at(-1)?.[0] as {
    txStatus: string;
    txHash?: string;
    data: Record<string, unknown>;
  };

// The MetaMask connector's 60 s limit, as viem wraps it.
let timedOut: Error;
let internal: Error;
let rejected: Error;
let unauthorized: Error;
let closedModal: Error;
let safeRefused: Error;
beforeAll(async () => {
  timedOut = await walletSendError(new Error('Transport request timed out'));
  internal = await walletSendError(Object.assign(new Error('Internal JSON-RPC error.'), { code: -32603 }));
  rejected = await walletSendError(Object.assign(new Error('User rejected the request.'), { code: 4001 }));
  unauthorized = await walletSendError(Object.assign(new Error('Unauthorized'), { code: 4100 }));
  closedModal = await walletSendError(new Error('User closed modal'));
  safeRefused = await walletSendError(new Error('Transaction was rejected'));
});

describe('a send the wallet never answered for', () => {
  beforeEach(() => i18n.activate('en'));
  afterEach(() => vi.clearAllMocks());

  it('says it could not be confirmed, with Close and nothing that sends it again', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    onTestFinished(() => invalidate.mockRestore());
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onError(timedOut, ''));

    expect(screen.getByText("Couldn't confirm transaction")).toBeDefined();
    expect(screen.getByText("Couldn't confirm")).toBeDefined();
    expect(screen.getByText('Transaction status unknown')).toBeDefined();
    expect(screen.getByText(/may still have gone through/)).toBeDefined();
    expect(screen.queryByText(/failed/i)).toBeNull();
    expect(screen.queryByText(/rolled back/i)).toBeNull();
    expect(screen.queryByText(/hasn't been approved/i)).toBeNull();
    expect(retryButtons()).toHaveLength(0);
    expect((screen.getByTestId('transaction-modal-back') as HTMLButtonElement).disabled).toBe(true);
    expect(failureMayStillMine()).toBe('true');
    // It may have executed: the page's on-chain reads are refreshed.
    type Filters = { predicate?: (q: { queryKey: unknown[]; meta?: Record<string, unknown> }) => boolean };
    expect(
      invalidate.mock.calls.some(([filters]) =>
        (filters as Filters).predicate?.({ queryKey: ['readContract', {}] })
      )
    ).toBe(true);

    fireEvent.click(screen.getByTestId('transaction-unconfirmed-close'));
    expect(screen.queryByText("Couldn't confirm transaction")).toBeNull();
  });

  it('is in doubt on a later step too, where the engine passes the previous hash', () => {
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onStart('0xapprove'));
    act(() => cb().onMutate());
    act(() => cb().onError(timedOut, '0xapprove'));

    expect(screen.getByText("Couldn't confirm transaction")).toBeDefined();
    expect(screen.queryByText(/hasn't been supplied/i)).toBeNull();
    expect(retryButtons()).toHaveLength(0);
    expect(failureMayStillMine()).toBe('true');
  });

  it('keeps its analytics and Sentry classification', () => {
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onError(timedOut, ''));

    expect(lastCompleted().txStatus).toBe('error');
    expect(lastCompleted().data).toMatchObject({
      error_kind: 'wallet_error',
      error_name: 'ContractFunctionExecutionError',
      error_code: -1
    });
    const ctx = vi.mocked(reportError).mock.calls[0][1];
    expect(ctx.type).toBe('transaction_error');
    expect(ctx.level).toBeUndefined();
  });
});

describe('a send the wallet answered for', () => {
  beforeEach(() => i18n.activate('en'));
  afterEach(() => {
    vi.clearAllMocks();
    wallet.connector = undefined;
  });

  it('the Safe App refusing it, which has no code, still fails the step, with Retry', () => {
    wallet.connector = { id: SAFE_CONNECTOR_ID };
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onError(safeRefused, ''));

    expect(screen.getAllByText('Transaction failed').length).toBeGreaterThan(0);
    expect(screen.queryByText("Couldn't confirm transaction")).toBeNull();
    expect(retryButtons().length).toBeGreaterThan(0);
    expect(failureMayStillMine()).toBe('false');
  });

  it('an internal wallet error still fails the step, with Retry', () => {
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onError(internal, ''));

    expect(screen.getAllByText('Transaction failed').length).toBeGreaterThan(0);
    expect(screen.getByText('Approve failed')).toBeDefined();
    expect(screen.queryByText("Couldn't confirm transaction")).toBeNull();
    expect(retryButtons().length).toBeGreaterThan(0);
    expect(failureMayStillMine()).toBe('false');
  });

  it('an error that is not a wallet send still fails the step, with Retry', () => {
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onError(new Error('Transport request timed out'), ''));

    expect(screen.getAllByText('Transaction failed').length).toBeGreaterThan(0);
    expect(retryButtons().length).toBeGreaterThan(0);
    expect(failureMayStillMine()).toBe('false');
  });

  it('a rejection still reads as declined, with Retry', () => {
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onError(rejected, ''));

    expect(screen.getByText('Transaction declined')).toBeDefined();
    expect(screen.getByText('Approve declined')).toBeDefined();
    expect(retryButtons().length).toBeGreaterThan(0);
    expect(failureMayStillMine()).toBe('false');
  });

  it('a wallet modal the user closed, which has no code, still reads as declined', () => {
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onError(closedModal, ''));

    expect(screen.getByText('Transaction declined')).toBeDefined();
    expect(screen.queryByText("Couldn't confirm transaction")).toBeNull();
    expect(retryButtons().length).toBeGreaterThan(0);
  });

  it("a request the wallet didn't allow still says so, with Retry", () => {
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onError(unauthorized, ''));

    expect(screen.getByText(/Your wallet didn't allow this request/)).toBeDefined();
    expect(screen.queryByText("Couldn't confirm transaction")).toBeNull();
    expect(retryButtons().length).toBeGreaterThan(0);
  });
});
