import { StrictMode, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreTransactionGate } from './preTransactionGate';
import type { TransactionConfig } from './configFlow.testing';

// The real TransactionProvider + TransactionModal, with chain, wallet, batch,
// analytics and toast reads stubbed: what a session owns and what it freezes.
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
vi.mock('@/modules/sentry/reportError', () => ({ reportError: vi.fn() }));
const analytics = vi.hoisted(() => ({
  trackWidgetReviewViewed: vi.fn(),
  trackTransactionStarted: vi.fn(),
  trackTransactionCompleted: vi.fn(),
  trackTermsSignatureDeclined: vi.fn()
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({ useAppAnalytics: () => analytics }));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn(), getFlowId: () => 'flow-test' })
}));
const toastWithCloseMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({
  toast: { dismiss: vi.fn() },
  toastWithClose: toastWithCloseMock
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

import { MODAL_EXIT_MS } from '@/modules/ui/animation/constants';
import { TransactionProvider, useSettleOnEnd } from './TransactionContext';
import { useTestTransaction, type TestTransaction } from './configFlow.testing';

i18n.load('en', {});
i18n.activate('en');

const SESSION = 'session-a';

function Harness({
  config,
  alongside,
  onReady
}: {
  config: TransactionConfig;
  alongside?: ReactNode;
  onReady: (ctx: TestTransaction) => void;
}) {
  const ctx = useTestTransaction();
  const started = useRef(false);
  useEffect(() => {
    onReady(ctx);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    ctx.launch(config, alongside);
  }, [ctx, config, alongside]);
  return null;
}

function renderFlow(
  config: TransactionConfig,
  { gate, alongside }: { gate?: PreTransactionGate; alongside?: ReactNode } = {}
) {
  let ctx!: TestTransaction;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider gate={gate}>
          <Harness config={config} alongside={alongside} onReady={c => (ctx = c)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  return () => ctx;
}

const lastToastElement = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)![0] as (id: string) => ReactElement;
  return renderFn('toast-id') as ReactElement<{ title?: string; onView?: () => void }>;
};

const probe = vi.hoisted(() => ({ mounted: 0 }));
function EngineProbe() {
  useEffect(() => {
    probe.mounted += 1;
    return () => {
      probe.mounted -= 1;
    };
  }, []);
  return null;
}

const engine = vi.hoisted(() => ({
  writeOut: false,
  settle: null as (() => void) | null,
  onCleared: vi.fn()
}));
// The executors' reset: with a write out it settles once that write lands, otherwise at once.
function SettlingEngine() {
  useSettleOnEnd(onCleared => {
    if (engine.writeOut) engine.settle = () => onCleared?.();
    else onCleared?.();
  }, engine.onCleared);
  return <EngineProbe />;
}

const convertConfig: TransactionConfig = {
  title: 'Convert',
  sessionId: SESSION,
  usdValue: 0,
  supportedChainIds: [1],
  onConfirm: () => {}
};
const confirmButton = () => screen.getByRole('button', { name: /confirm/i });
const afterExit = () => act(() => new Promise(resolve => setTimeout(resolve, MODAL_EXIT_MS + 50)));

describe('a transaction session', () => {
  beforeEach(() => {
    probe.mounted = 0;
    engine.writeOut = false;
    engine.settle = null;
  });
  afterEach(() => vi.clearAllMocks());

  it('keeps the confirmed figures on the wallet and failure screens while the flow re-renders', () => {
    const get = renderFlow({
      title: 'Supply',
      sessionId: SESSION,
      usdValue: 10,
      supportedChainIds: [1],
      steps: ['Supply'],
      transactionContent: <div>Review 10 USDS</div>,
      transactionScreenContent: <div>Supplying 10 USDS</div>,
      onConfirm: () => {}
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    act(() => get().txCallbacks.onMutate());

    // The flow's reads move on (a refetch zeroes the form): the screen must not follow.
    act(() =>
      get().updateModalContent(SESSION, {
        transactionScreenContent: <div>Supplying 0 USDS</div>,
        steps: ['Approve', 'Supply']
      })
    );
    expect(screen.queryByText('Supplying 10 USDS')).not.toBeNull();
    expect(screen.queryByText('Supplying 0 USDS')).toBeNull();
    expect(screen.queryByText('Approve')).toBeNull();

    act(() => get().txCallbacks.onError(new Error('execution reverted')));
    expect(screen.queryByText('Supplying 10 USDS')).not.toBeNull();

    // Back returns to IDLE: the flow's current props apply again.
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(screen.queryByText('Supplying 0 USDS')).not.toBeNull();
  });

  it('reports the confirmed analytics and toast on success, not the flow’s later props', () => {
    const get = renderFlow({
      title: 'Supply',
      sessionId: SESSION,
      usdValue: 10,
      supportedChainIds: [1],
      toast: { success: '10 USDS supplied!' },
      analytics: { widgetName: 'savings', flow: 'supply', action: 'supply', data: { amount: 10 } },
      onConfirm: () => {}
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    act(() => get().txCallbacks.onMutate());
    act(() => get().txCallbacks.onStart('0xhash'));
    act(() =>
      get().updateModalContent(SESSION, {
        toast: { success: '0 USDS supplied!' },
        analytics: { widgetName: 'savings', flow: 'supply', action: 'supply', data: { amount: 0 } }
      })
    );

    act(() => get().txCallbacks.onSuccess('0xhash'));

    expect(analytics.trackTransactionCompleted).toHaveBeenLastCalledWith(
      expect.objectContaining({ txStatus: 'success', data: { amount: 10 } })
    );
    expect(lastToastElement().props.title).toBe('10 USDS supplied!');
  });

  it('applies the clicked secondary CTA’s steps and analytics from the click, through the gate', async () => {
    let release!: () => void;
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setGateStatus('screening');
      return new Promise(resolve => {
        release = () => {
          controls.setGateStatus('idle');
          resolve({ allow: true });
        };
      });
    };
    const onSecondaryConfirm = vi.fn();
    const get = renderFlow(
      {
        title: 'Claim rewards',
        sessionId: SESSION,
        usdValue: 10,
        supportedChainIds: [1],
        entry: {
          content: <div>rewards</div>,
          confirmLabel: 'Claim & Restake',
          confirmDisabled: false,
          secondaryConfirmLabel: 'Claim',
          secondaryConfirmDisabled: false
        },
        steps: ['Restake all'],
        analytics: { widgetName: 'stake', flow: 'manage', action: 'claimAndRestake' },
        secondarySteps: ['Claim all'],
        secondaryAnalytics: { widgetName: 'stake', flow: 'manage', action: 'claim' },
        onConfirm: () => {},
        onSecondaryConfirm
      },
      { gate }
    );

    fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
    // The gate holds the floor: the step list already names the clicked action.
    expect(screen.queryByText('Claim all')).not.toBeNull();
    expect(screen.queryByText('Restake all')).toBeNull();

    await act(async () => release());
    expect(onSecondaryConfirm).toHaveBeenCalledTimes(1);
    act(() => get().txCallbacks.onMutate());
    expect(analytics.trackTransactionStarted).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'claim' })
    );
  });

  it('keeps a closed session’s flow mounted through the exit animation, then unmounts it', async () => {
    renderFlow(
      { title: 'Supply', usdValue: 0, supportedChainIds: [1], onConfirm: () => {} },
      { alongside: <EngineProbe /> }
    );
    expect(probe.mounted).toBe(1);

    fireEvent.click(screen.getByTestId('transaction-modal-close'));
    expect(probe.mounted).toBe(1);

    await act(() => new Promise(resolve => setTimeout(resolve, MODAL_EXIT_MS + 50)));
    expect(probe.mounted).toBe(0);
  });

  it('replaces a closing session at once when a new flow launches', () => {
    const get = renderFlow(
      { title: 'Supply', usdValue: 0, supportedChainIds: [1], onConfirm: () => {} },
      { alongside: <EngineProbe /> }
    );
    fireEvent.click(screen.getByTestId('transaction-modal-close'));
    expect(probe.mounted).toBe(1);

    act(() => get().launch({ title: 'Withdraw', usdValue: 0, supportedChainIds: [1], onConfirm: () => {} }));
    expect(probe.mounted).toBe(0);
    expect(screen.queryByText('Withdraw')).not.toBeNull();
  });

  it('keeps an ended flow mounted until its write lands, holding the same surface’s next Confirm', async () => {
    const get = renderFlow(convertConfig, { alongside: <SettlingEngine /> });
    fireEvent.click(confirmButton());
    act(() => get().txCallbacks.onMutate());
    engine.writeOut = true;
    fireEvent.click(screen.getByTestId('transaction-modal-close'));
    await afterExit();
    expect(probe.mounted).toBe(1);

    act(() => get().launch(convertConfig));
    expect(confirmButton().hasAttribute('disabled')).toBe(true);
    expect(engine.onCleared).not.toHaveBeenCalled();

    act(() => engine.settle?.());
    expect(engine.onCleared).toHaveBeenCalledTimes(1);
    expect(probe.mounted).toBe(0);
    expect(confirmButton().hasAttribute('disabled')).toBe(false);
  });

  it('holds the same way when a relaunch abandons the wallet prompt', () => {
    const get = renderFlow(convertConfig, { alongside: <SettlingEngine /> });
    fireEvent.click(confirmButton());
    act(() => get().txCallbacks.onMutate());
    engine.writeOut = true;

    act(() => get().launch(convertConfig));
    expect(probe.mounted).toBe(1);
    expect(confirmButton().hasAttribute('disabled')).toBe(true);

    act(() => engine.settle?.());
    expect(engine.onCleared).toHaveBeenCalledTimes(1);
    expect(probe.mounted).toBe(0);
    expect(confirmButton().hasAttribute('disabled')).toBe(false);
  });

  it('settles at once when nothing is out: the flow leaves after its exit and holds nothing', async () => {
    const get = renderFlow(convertConfig, { alongside: <SettlingEngine /> });
    fireEvent.click(screen.getByTestId('transaction-modal-close'));
    expect(engine.onCleared).toHaveBeenCalledTimes(1);
    await afterExit();
    expect(probe.mounted).toBe(0);

    act(() => get().launch(convertConfig));
    expect(confirmButton().hasAttribute('disabled')).toBe(false);
  });

  it('restores from the minimized toast, after which a navigation closes a settled session as usual', () => {
    const get = renderFlow({ title: 'Supply', usdValue: 0, supportedChainIds: [1], onConfirm: () => {} });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    act(() => get().txCallbacks.onMutate());
    act(() => get().txCallbacks.onStart('0xhash'));
    act(() => get().minimize());
    act(() => get().txCallbacks.onError(new Error('execution reverted')));

    act(() => lastToastElement().props.onView?.());
    expect(get().isMinimized).toBe(false);

    act(() => get().closeOnNavigation('/elsewhere'));
    expect(get().isModalOpen).toBe(false);
  });
});
