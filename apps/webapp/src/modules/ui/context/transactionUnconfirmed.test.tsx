// APP-649: a sent bridge whose outcome is unknown is shown as not confirmed yet, never as rolled back.
import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from './transactionContract';
import { markUnconfirmed } from '@/hooks/shared/useTransactionOutcome';
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

const REASON = 'Follow it on its card.';

describe('a sent bridge whose outcome is unknown', () => {
  beforeEach(() => i18n.activate('en'));
  afterEach(() => vi.clearAllMocks());

  const sendBridge = (cb: () => TxCallbacks) => {
    for (const hash of ['0xapprove', '0xswap', '0xapprove2', '0xbridge']) {
      act(() => cb().onMutate());
      act(() => cb().onStart(hash));
    }
  };

  it('says it is not confirmed yet, with its reason, and offers no Retry', () => {
    const cb = renderFlow();
    sendBridge(cb);
    act(() => cb().onError(markUnconfirmed(new Error('HTTP request failed.'), REASON), '0xbridge'));
    expect(screen.queryByText(/rolled back/i)).toBeNull();
    expect(screen.queryByText(/hasn't been bridged/i)).toBeNull();
    expect(hasText('Bridge not confirmed yet')).toBe(true);
    expect(hasText(REASON)).toBe(true);
    expect(hasText('Transaction not confirmed')).toBe(true);
    expect(hasText('Not confirmed')).toBe(true);
    expect(retryButtons()).toHaveLength(0);
  });

  it('still shows a revert as rolled back, with Retry', () => {
    const cb = renderFlow();
    sendBridge(cb);
    act(() => cb().onError(new Error('reverted'), '0xbridge'));
    expect(hasText('The network rolled back your transaction.')).toBe(true);
    expect(hasText('Not confirmed')).toBe(false);
    expect(retryButtons().length).toBeGreaterThan(0);
  });
});
