import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';
import type { PreTransactionGate } from './preTransactionGate';
import { erc20Abi, type Call } from 'viem';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads.
// The provider needs a live wagmi tree; these suites exercise the transaction
// state machine, so the shared chain switch is stubbed inert.
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
  trackTransactionCompleted: vi.fn(),
  trackTermsSignatureDeclined: vi.fn()
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => analytics
}));
const toastWithCloseMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({
  toast: { dismiss: vi.fn() },
  toastWithClose: toastWithCloseMock
}));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
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

// Render the node the provider handed to toastWithClose (header + body notice).
const renderLastToast = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)![0] as (id: string) => ReactNode;
  return render(<I18nProvider i18n={i18n}>{renderFn('toast-id')}</I18nProvider>);
};

const POOL = '0x2222222222222222222222222222222222222222';
const TOKEN = '0x1111111111111111111111111111111111111111';
const approve = { to: TOKEN, abi: erc20Abi, functionName: 'approve', args: [POOL, 100n] } as Call;
// Stands in for a swap whose last argument is the quote-derived minimum output.
const swap = (minOut: bigint) =>
  ({ to: POOL, abi: erc20Abi, functionName: 'transferFrom', args: [TOKEN, POOL, minOut] }) as Call;

// A flow whose engine keeps rebuilding its calls from a live quote after the
// review froze — the test moves `live.calls` the way a quote refetch would.
function driftingFlow(onConfirm: () => void, calls: Call[]) {
  const live = { calls };
  const config: TransactionConfig = {
    title: 'Supply',
    usdValue: 0,
    supportedChainIds: [1],
    onConfirm,
    getNextCalls: () => live.calls
  };
  return { live, config };
}

const lastToastTitle = () => renderLastToast().getByText('Transaction details changed');

describe('TransactionProvider deferred dispatch re-validation', () => {
  beforeEach(() => {
    i18n.activate('en');
  });
  afterEach(() => vi.clearAllMocks());

  it('refuses an async allow when the calls changed while the verdict was pending', async () => {
    const onConfirm = vi.fn();
    let resolveVerdict!: (v: { allow: boolean }) => void;
    const gate: PreTransactionGate = () => new Promise(resolve => (resolveVerdict = resolve));
    const { live, config } = driftingFlow(onConfirm, [approve, swap(900n)]);
    renderWithGate(gate, config);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    live.calls = [approve, swap(350n)];
    resolveVerdict({ allow: true });
    await flush();

    expect(onConfirm).not.toHaveBeenCalled();
    expect(lastToastTitle()).toBeTruthy();
    // Back on the first screen, where Confirm re-reviews the new figures.
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeNull();
  });

  it('runs an async allow when the calls are unchanged', async () => {
    const onConfirm = vi.fn();
    const { config } = driftingFlow(onConfirm, [approve, swap(900n)]);
    renderWithGate(async () => ({ allow: true }), config);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('runs an async allow when only the approve dropped off the front', async () => {
    const onConfirm = vi.fn();
    let resolveVerdict!: (v: { allow: boolean }) => void;
    const gate: PreTransactionGate = () => new Promise(resolve => (resolveVerdict = resolve));
    const { live, config } = driftingFlow(onConfirm, [approve, swap(900n)]);
    renderWithGate(gate, config);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    live.calls = [swap(900n)];
    resolveVerdict({ allow: true });
    await flush();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('refuses a retry once the calls moved since the confirm', () => {
    const onConfirm = vi.fn();
    const { live, config } = driftingFlow(onConfirm, [approve, swap(900n)]);
    const cb = renderWithGate(() => ({ allow: true }), config);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    act(() => cb.onMutate());
    act(() => cb.onError(new Error('execution reverted')));

    live.calls = [swap(350n)];
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(lastToastTitle()).toBeTruthy();
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('retries the confirmed calls after the approve landed', () => {
    const onConfirm = vi.fn();
    const { live, config } = driftingFlow(onConfirm, [approve, swap(900n)]);
    const cb = renderWithGate(() => ({ allow: true }), config);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    act(() => cb.onMutate());
    act(() => cb.onError(new Error('rejected in wallet')));

    live.calls = [swap(900n)];
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('a fresh confirm after being sent back re-captures the new calls', async () => {
    const onConfirm = vi.fn();
    let resolveVerdict!: (v: { allow: boolean }) => void;
    const gate: PreTransactionGate = () => new Promise(resolve => (resolveVerdict = resolve));
    const { live, config } = driftingFlow(onConfirm, [swap(900n)]);
    renderWithGate(gate, config);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    live.calls = [swap(350n)];
    resolveVerdict({ allow: true });
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    resolveVerdict({ allow: true });
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('leaves flows that report no calls to the gate alone', () => {
    const onConfirm = vi.fn();
    const cb = renderWithGate(() => ({ allow: true }), {
      title: 'Supply',
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm
    });

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    act(() => cb.onMutate());
    act(() => cb.onError(new Error('execution reverted')));
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
