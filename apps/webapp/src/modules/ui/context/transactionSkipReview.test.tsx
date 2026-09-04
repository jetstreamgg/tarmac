import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig, TxCallbacks } from './transactionContract';
import type { PreTransactionGate } from './preTransactionGate';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionGate.test.tsx).
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
vi.mock('@/components/ui/use-toast', () => ({
  toast: { dismiss: vi.fn() },
  toastWithClose: vi.fn()
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

const skipReviewConfig = (
  onConfirm: () => void,
  extra: Partial<TransactionConfig> = {}
): TransactionConfig => ({
  title: 'Confirm',
  transactionTitle: 'Confirm your transaction',
  transactionContent: <div data-testid="full-summary">full summary</div>,
  transactionScreenContent: <div data-testid="hero">hero</div>,
  usdValue: 0,
  supportedChainIds: [1],
  skipReview: true,
  analytics: { widgetName: 'stake', flow: 'open', action: 'multicall' },
  onConfirm,
  ...extra
});

/**
 * `skipReview` launches (the stake takeovers, Design QA 2800:91832): the
 * flow's own surface was the review, so launch opens the wallet/status screen
 * and fires the gated confirm itself — nothing but the in-modal review body is
 * skipped.
 */
describe('TransactionProvider — skipReview launches', () => {
  beforeEach(() => {
    i18n.activate('en');
  });
  afterEach(() => vi.clearAllMocks());

  it('opens on the wallet screen and fires the gated onConfirm exactly once (StrictMode)', () => {
    const onConfirm = vi.fn();
    const gate = vi.fn(() => ({ allow: true }));
    renderWithGate(gate, skipReviewConfig(onConfirm));

    // No review: no first-screen CTA, no review body, the wallet-screen hero
    // and title are up from the start.
    expect(screen.queryByRole('button', { name: /^confirm$/i })).toBeNull();
    expect(screen.queryByTestId('full-summary')).toBeNull();
    expect(screen.getByTestId('hero')).not.toBeNull();
    expect(screen.getByText('Confirm your transaction')).not.toBeNull();

    // Through the gate, once — StrictMode's replayed mount effect must not
    // start a second transaction.
    expect(gate).toHaveBeenCalledTimes(1);
    expect(gate).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('still emits the review-viewed event at launch — the takeover was the review', () => {
    renderWithGate(() => ({ allow: true }), skipReviewConfig(vi.fn()));

    expect(analytics.trackWidgetReviewViewed).toHaveBeenCalledTimes(1);
    expect(analytics.trackWidgetReviewViewed).toHaveBeenCalledWith(
      expect.objectContaining({ widgetName: 'stake', flow: 'open', action: 'multicall' })
    );
  });

  it('an async verdict (screening, the terms signature) defers onConfirm until it allows', async () => {
    const onConfirm = vi.fn();
    let resolveVerdict!: (v: { allow: boolean }) => void;
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setGateStatus('screening', { badgeLabel: 'Checking' });
      return new Promise(resolve => (resolveVerdict = resolve));
    };
    renderWithGate(gate, skipReviewConfig(onConfirm));

    // The gate holds the floor on the wallet screen; nothing has fired.
    expect(screen.getByText('Checking')).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => resolveVerdict({ allow: true }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('a denial never runs onConfirm', async () => {
    const onConfirm = vi.fn();
    renderWithGate(() => ({ allow: false }), skipReviewConfig(onConfirm));
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("the gate's returnToFirstScreen closes the modal — there is no first screen to return to", async () => {
    const onConfirm = vi.fn();
    let deny!: () => void;
    const gate: PreTransactionGate = ({ controls }) => {
      controls.setGateStatus('screening');
      return new Promise(resolve => {
        deny = () => {
          controls.returnToFirstScreen();
          resolve({ allow: false });
        };
      });
    };
    renderWithGate(gate, skipReviewConfig(onConfirm, { steps: ['Approve SKY', 'Stake SKY'] }));
    expect(screen.getByText('Approve SKY')).not.toBeNull();

    await act(async () => deny());

    // Closed, not parked on an empty "Preparing" wallet screen: the takeover
    // underneath renders the denial through useTransactionPreflight.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText('Approve SKY')).toBeNull();
    expect(screen.queryByText('Confirm your transaction')).toBeNull();
  });

  it('a failure offers Retry alone — no Back to a review that never existed', () => {
    const onConfirm = vi.fn();
    const cb = renderWithGate(() => ({ allow: true }), skipReviewConfig(onConfirm));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => cb.onMutate());
    act(() => cb.onError(new Error('rejected in wallet')));

    expect(screen.getByRole('button', { name: /retry/i })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^back$/i })).toBeNull();
    // The header arrow's slot never opens either (the screen IS the first one).
    expect(screen.queryByTestId('transaction-modal-back')).toBeNull();

    // Retry runs the gate again and fires once more.
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it('review-first configs are unchanged: launch renders the review and waits for its Confirm', () => {
    const onConfirm = vi.fn();
    renderWithGate(() => ({ allow: true }), {
      title: 'Confirm',
      transactionContent: <div data-testid="full-summary">full summary</div>,
      usdValue: 0,
      supportedChainIds: [1],
      onConfirm
    });

    expect(screen.getByTestId('full-summary')).not.toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
