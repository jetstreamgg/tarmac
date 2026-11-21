// A send refused before any write shows its reason, not a rollback.
import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from './transactionContract';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import type { TransactionStep } from '@/modules/ui/components/TransactionModal';

// Same stubs as transactionFailure.test.tsx: the real provider and modal, inert chain/wallet/analytics.
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

// The CCTP burn's steps as useBridgeLaunch builds them.
const CCTP_STEPS: TransactionStep[] = [
  { label: 'Approve', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been approved." },
  { label: 'Swap to USDC', tokenSymbol: 'USDS', failureDetail: "The USDS hasn't been swapped." },
  { label: 'Approve', tokenSymbol: 'USDC', failureDetail: "The USDC hasn't been approved." },
  { label: 'Bridge', tokenSymbol: 'USDC', failureDetail: "The USDC hasn't been bridged." }
];

function Harness({ onReady }: { onReady: (cb: TxCallbacks) => void }) {
  const { launch, txCallbacks } = useTransaction();
  const started = useRef(false);
  useEffect(() => {
    onReady(txCallbacks);
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch({
      title: 'Review USDS bridge',
      usdValue: 0,
      supportedChainIds: [1],
      steps: CCTP_STEPS,
      onConfirm: () => {}
    });
  }, [launch]);
  return null;
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

const hasText = (text: string) => screen.queryAllByText(content => content.includes(text)).length > 0;
const retryButtons = () => screen.queryAllByRole('button', { name: /^(retry|try again)$/i });

describe('B-9: a CCTP send refused by its preflight', () => {
  beforeEach(() => i18n.activate('en'));
  afterEach(() => vi.clearAllMocks());

  // What useBridgeCallLegs sends when its preflight refuses: no onMutate, then onError(refusal, '').
  it.each([
    { refusal: 'CCTP is paused.', final: false },
    { refusal: "The network isn't synced up to the swap yet. Try again in a moment.", final: false },
    { refusal: 'This swap is too old for this app to check, so it cannot be continued.', final: true }
  ])('shows "$refusal" and claims no rollback', ({ refusal, final }) => {
    const cb = renderFlow();
    act(() => cb().onError(new TransactionRefusedError(refusal, { final }), ''));
    // Nothing was sent: no rolled-back transaction, no unapproved USDS.
    expect(screen.queryByText(/rolled back/i)).toBeNull();
    expect(screen.queryByText(/hasn't been approved/i)).toBeNull();
    // The user is told why, and that nothing left the wallet.
    expect(hasText(refusal)).toBe(true);
    expect(hasText('Nothing was sent.')).toBe(true);
    // A refusal that sending again can't lift offers no retry.
    expect(retryButtons().length > 0).toBe(!final);
  });

  it('a refusal without a message for the user says nothing was sent and keeps Retry', () => {
    const cb = renderFlow();
    act(() => cb().onError(new Error('Refusing to send a batch that failed simulation: 0xdead'), ''));
    expect(screen.queryByText(/rolled back/i)).toBeNull();
    expect(screen.queryByText(/hasn't been approved/i)).toBeNull();
    expect(hasText('0xdead')).toBe(false);
    expect(hasText('Nothing was sent.')).toBe(true);
    expect(retryButtons().length).toBeGreaterThan(0);
  });

  it('a refusal on a Retry after a mined step shows its reason, without claiming nothing was sent', () => {
    const cb = renderFlow();
    act(() => cb().onMutate());
    act(() => cb().onStart('0xapprove'));
    act(() => cb().onMutate());
    act(() => cb().onStart('0xswap'));
    act(() => cb().onError(new Error('reverted'), '0xswap'));
    fireEvent.click(retryButtons()[0]);
    act(() => cb().onError(new TransactionRefusedError('CCTP is paused.'), ''));
    expect(screen.queryByText(/rolled back/i)).toBeNull();
    expect(hasText('CCTP is paused.')).toBe(true);
    // The approve went through.
    expect(hasText('Nothing was sent.')).toBe(false);
    expect(retryButtons().length).toBeGreaterThan(0);
  });
});
