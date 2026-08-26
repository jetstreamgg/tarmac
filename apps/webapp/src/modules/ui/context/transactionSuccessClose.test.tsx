import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';

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
function renderFlow(config: TransactionConfig): TxCallbacks {
  let cb!: TxCallbacks;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness config={config} onReady={c => (cb = c)} />
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
  steps: ['Supply'],
  subtitles: { success: "You've successfully supplied to Sky Savings." },
  toast: { success: '10,000.00 USDS supplied!' },
  onConfirm: () => {}
};

describe('TransactionModal success handoff', () => {
  afterEach(() => vi.clearAllMocks());

  it('closes the modal and moves the outcome to a toast', () => {
    const cb = renderFlow(CONFIG);

    act(() => cb.onMutate());
    act(() => cb.onStart(HASH));
    expect(screen.queryByText('Supply')).not.toBeNull();

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

  it('falls back to the success subtitle when the flow sets no toast copy', () => {
    const cb = renderFlow({ ...CONFIG, toast: undefined });

    act(() => cb.onMutate());
    act(() => cb.onStart(HASH));
    act(() => cb.onSuccess(HASH));

    const { getByText } = renderLastToast();
    expect(getByText("You've successfully supplied to Sky Savings.")).toBeDefined();
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
});
