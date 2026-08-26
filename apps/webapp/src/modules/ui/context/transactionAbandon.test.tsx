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
import { TxStatus } from '@/widgets';

i18n.load('en', {});
i18n.activate('en');

const SUPPLY_CONFIG: TransactionConfig = {
  title: 'Supply USDS',
  usdValue: 0,
  steps: ['Supply'],
  analytics: { widgetName: 'savings', flow: 'supply' },
  onConfirm: () => {}
};

const STAKE_CONFIG: TransactionConfig = {
  title: 'Stake SKY',
  usdValue: 0,
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
  // Report the LATEST context value on every render: engine callbacks are
  // bound to the session generation that rendered them, so tests must capture
  // them the way real engines do — from the value current after launch.
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

// The live context value, refreshed on every provider render. An engine whose
// host UNMOUNTS on teardown keeps calling the snapshot its last render closed
// over (see cbOf); one whose host stays mounted calls THIS — react-query pushes
// each render's options into the pending mutation and the receipt effect closes
// over the current render. The review-first flows are the mounted kind.
let liveCtx!: TransactionContextValue;

// Mounts the provider, opens the modal, and advances to the transaction screen.
function renderFlow(config: TransactionConfig = SUPPLY_CONFIG): TransactionContextValue {
  let ctx!: TransactionContextValue;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness
            config={config}
            onReady={c => {
              ctx = c;
              liveCtx = c;
            }}
          />
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

// An in-flight write outlives its host: the wallet can accept in the same
// instant the user dismisses the modal, so the orphaned engine's callbacks fire
// AFTER teardown. They must recognise their session ended — without the
// generation guard a late onStart stranded txStatusRef at LOADING with no modal
// to restore, blocking every later launch() until a page reload (APP-416).
describe('stale engine callbacks after teardown (APP-416)', () => {
  afterEach(() => vi.clearAllMocks());

  it('a late onStart from a closed session is dropped — the next launch opens instead of hitting the in-progress guard', () => {
    const ctx = renderFlow();
    const staleCb = cbOf(ctx);

    act(() => staleCb.onMutate()); // INITIALIZED — wallet prompt open
    act(() => fireEvent.click(screen.getByTestId('transaction-modal-close'))); // abandon
    toastWithCloseMock.mockClear();

    // The wallet had already accepted: the orphaned engine reports broadcast late.
    act(() => staleCb.onStart('0xdeadbeef'));

    // A fresh flow launches normally — no "Transaction in progress" block.
    act(() => ctx.launch(STAKE_CONFIG));
    expect(screen.queryByText('Stake SKY')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeNull();
    expect(toastWithCloseMock).not.toHaveBeenCalled();
  });

  it('a late onSuccess from an abandoned session leaves the replacing session untouched', () => {
    const onNewSuccess = vi.fn();
    const ctx = renderFlow();
    const staleCb = cbOf(ctx);

    act(() => staleCb.onMutate()); // INITIALIZED
    act(() => ctx.launch({ ...STAKE_CONFIG, onSuccess: onNewSuccess })); // abandons the supply session
    analytics.trackTransactionCompleted.mockClear();

    act(() => staleCb.onSuccess('0xdeadbeef')); // old engine settles late

    // The new session still sits on its first screen: the foreign success
    // neither advanced its status nor fired the NEW config's onSuccess.
    expect(onNewSuccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeNull();
    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
  });
});

// The review-first flows (convert, pendle redeem, the stake takeovers) launch
// with only `transactionContent` — their engine lives on the PAGE and stays
// mounted under the overlay. Teardown never freezes its closures, so a late
// callback arrives through the CURRENT render's callbacks (liveCtx) and the
// generation it closes over is the new session's. What tells the two apart is
// the generation latched when the write actually started (onMutate).
describe('stale engine callbacks from a still-mounted host (APP-416)', () => {
  afterEach(() => vi.clearAllMocks());

  it('a late onStart from a closed session does not strand the provider — the next launch opens without the in-progress block', () => {
    const ctx = renderFlow();

    act(() => liveCtx.txCallbacks.onMutate()); // INITIALIZED — wallet prompt open
    act(() => fireEvent.click(screen.getByTestId('transaction-modal-close'))); // abandon
    toastWithCloseMock.mockClear();

    // The wallet had already accepted; the mounted engine reports broadcast late.
    act(() => liveCtx.txCallbacks.onStart('0xdeadbeef'));

    act(() => ctx.launch(STAKE_CONFIG));
    expect(screen.queryByText('Stake SKY')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeNull();
    expect(toastWithCloseMock).not.toHaveBeenCalled();
  });

  it('a late onStart from an abandoned write leaves the replacing session on its review screen', () => {
    const ctx = renderFlow();

    act(() => liveCtx.txCallbacks.onMutate()); // INITIALIZED
    act(() => ctx.launch(STAKE_CONFIG)); // abandons the supply session

    act(() => liveCtx.txCallbacks.onStart('0xdeadbeef')); // old write broadcasts late

    // The new session must not adopt the foreign broadcast: still awaiting confirm.
    expect(screen.queryByText('Stake SKY')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /processing/i })).toBeNull();
  });

  it('a late onSuccess from an abandoned write neither settles the replacing session nor fires its onSuccess', () => {
    const onNewSuccess = vi.fn();
    const ctx = renderFlow();

    act(() => liveCtx.txCallbacks.onMutate()); // INITIALIZED
    act(() => ctx.launch({ ...STAKE_CONFIG, onSuccess: onNewSuccess }));
    analytics.trackTransactionCompleted.mockClear();

    act(() => liveCtx.txCallbacks.onSuccess('0xdeadbeef')); // old write settles late

    expect(onNewSuccess).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^confirm$/i })).not.toBeNull();
    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
  });

  it('a settle for a foreign hash is ignored while this session has its own write in flight', () => {
    const onNewSuccess = vi.fn();
    const ctx = renderFlow();

    act(() => liveCtx.txCallbacks.onMutate()); // supply session: wallet prompt
    act(() => ctx.launch({ ...STAKE_CONFIG, onSuccess: onNewSuccess })); // abandoned

    // The new session runs its OWN write through to broadcast, re-latching the
    // generation — only the hash still tells the abandoned write apart.
    act(() => liveCtx.txCallbacks.onMutate());
    act(() => liveCtx.txCallbacks.onStart('0xnewhash'));
    analytics.trackTransactionCompleted.mockClear();

    act(() => liveCtx.txCallbacks.onSuccess('0xdeadbeef')); // the ABANDONED tx mines

    // Still processing its own transaction — not settled by the foreign one.
    expect(onNewSuccess).not.toHaveBeenCalled();
    expect(analytics.trackTransactionCompleted).not.toHaveBeenCalled();
    // Still mining its own transaction — the foreign settle did not land.
    expect(liveCtx.txStatus).toBe(TxStatus.LOADING);

    // ...and its own settle still lands.
    act(() => liveCtx.txCallbacks.onSuccess('0xnewhash'));
    expect(onNewSuccess).toHaveBeenCalledTimes(1);
  });
});
