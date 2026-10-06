import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionMinimize.test).
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

const chainMock = vi.hoisted(() => ({ id: 1 }));
vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => chainMock.id,
  useChains: () => [
    { id: 1, name: 'Ethereum' },
    { id: 8453, name: 'Base' }
  ],
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
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
}));

const refreshHistoryMock = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/lib/historyRefresh', () => ({ refreshHistoryAfterTx: refreshHistoryMock }));

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

const HASH = '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

function Harness({ config, onReady }: { config: TransactionConfig; onReady: (cb: TxCallbacks) => void }) {
  const { launch, txCallbacks } = useTransaction();
  const started = useRef(false);
  // The callbacks are bound to the session generation that rendered them, so
  // report the latest ones every render — the way a real engine holds them.
  useEffect(() => {
    onReady(txCallbacks);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch(config);
  }, [launch, config]);
  return null;
}

// Mounts the provider, opens the modal and advances it to the transaction screen.
// `onReady` sees the callbacks of every render, for a test that re-renders mid-flow.
function renderFlow(config: TransactionConfig, onReady?: (cb: TxCallbacks) => void): TxCallbacks {
  let cb!: TxCallbacks;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness
            config={config}
            onReady={c => {
              cb = c;
              onReady?.(c);
            }}
          />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
  return cb;
}

// Render the node the provider handed to toastWithClose.
const renderLastToast = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)![0] as (id: string) => ReactNode;
  return render(<I18nProvider i18n={i18n}>{renderFn('toast-id')}</I18nProvider>);
};

const CONFIG: TransactionConfig = {
  title: 'Supply',
  usdValue: 0,
  supportedChainIds: [1],
  steps: ['Supply'],
  toast: { success: '10,000.00 USDS supplied!' },
  onConfirm: () => {}
};

describe('TransactionModal success handoff', () => {
  afterEach(() => {
    vi.clearAllMocks();
    chainMock.id = 1;
  });

  it('closes the modal and moves the outcome to a toast', () => {
    const cb = renderFlow(CONFIG);

    act(() => cb.onMutate());
    act(() => cb.onStart(HASH));
    expect(screen.queryAllByText('Supply').length).toBeGreaterThan(0);

    act(() => cb.onSuccess(HASH));

    // No success screen, no Done button — the modal is gone.
    expect(screen.queryByText('Supply')).toBeNull();
    expect(screen.queryByRole('button', { name: /done/i })).toBeNull();

    // The toast carries the amount-aware headline and the hash as an explorer link.
    const { getByTestId, getByText } = renderLastToast();
    expect(getByTestId('transaction-success-toast')).toBeDefined();
    expect(getByText('10,000.00 USDS supplied!')).toBeDefined();
    const link = getByText('0xabcd...6789').closest('a');
    expect(link?.getAttribute('href')).toContain(HASH);
  });

  it('falls back to the title when the flow sets no toast copy — there is no subtitle to fall back on', () => {
    const cb = renderFlow({ ...CONFIG, toast: undefined });

    act(() => cb.onMutate());
    act(() => cb.onStart(HASH));
    act(() => cb.onSuccess(HASH));

    const { getByText } = renderLastToast();
    expect(getByText('Supply')).toBeDefined();
  });

  it('drops the hash line when a batched transaction settles without one', () => {
    const cb = renderFlow(CONFIG);

    act(() => cb.onMutate());
    act(() => cb.onSuccess());

    const { queryByRole } = renderLastToast();
    expect(queryByRole('link')).toBeNull();
  });

  it('dismisses the minimized toast so the two never stack', () => {
    const cb = renderFlow(CONFIG);

    act(() => cb.onMutate());
    act(() => cb.onStart(HASH));
    act(() => cb.onSuccess(HASH));

    expect(toastMock.dismiss).toHaveBeenCalledWith('transaction-minimized');
    // One toast for the outcome, not one per surface.
    expect(toastWithCloseMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes the history tables once the indexer reaches the receipt block', () => {
    const cb = renderFlow(CONFIG);

    act(() => cb.onMutate());
    act(() => cb.onStart(HASH));
    expect(refreshHistoryMock).not.toHaveBeenCalled();

    act(() => cb.onSuccess(HASH, 123n));

    expect(refreshHistoryMock).toHaveBeenCalledTimes(1);
    expect(refreshHistoryMock).toHaveBeenCalledWith(expect.anything(), { chainId: 1, blockNumber: 123n });
  });

  it("polls the indexer for the session's chain when the receipt lands after a network switch", () => {
    let cb: TxCallbacks | undefined;
    renderFlow(CONFIG, latest => (cb = latest));

    act(() => cb!.onMutate());
    chainMock.id = 8453;
    // Re-renders the provider on the new chain, handing out callbacks that close over it.
    act(() => cb!.onStart(HASH));
    act(() => cb!.onSuccess(HASH, 123n));

    expect(refreshHistoryMock).toHaveBeenCalledWith(expect.anything(), { chainId: 1, blockNumber: 123n });
  });
});
