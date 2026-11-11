// The failure on show is the latest one: a refusal is neither dropped nor left over for a later failure.
import { StrictMode, useEffect, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TxCallbacks } from './transactionContract';
import type { PreTransactionGate } from './preTransactionGate';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';

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

// The gate signs the terms first when `signature` is set; the user declines it.
const gateState = vi.hoisted(() => ({ signature: false }));
const gate: PreTransactionGate = ({ controls }) => {
  if (!gateState.signature) return { allow: true };
  controls.setPreludeSteps([
    { label: 'Terms signature', kind: 'signature', description: 'Sign in your wallet' }
  ]);
  controls.setGateStatus('signature');
  return Promise.resolve().then(() => {
    controls.setGateStatus('error');
    return { allow: false };
  });
};

function Harness({ onReady }: { onReady: (cb: TxCallbacks) => void }) {
  const { launch, txCallbacks } = useTransaction();
  useEffect(() => {
    onReady(txCallbacks);
  });
  return (
    <button
      data-testid="launch"
      onClick={() =>
        launch({
          title: 'Review USDS bridge',
          usdValue: 0,
          supportedChainIds: [1],
          steps: ['Bridge'],
          onConfirm: () => {}
        })
      }
    />
  );
}

function renderProvider() {
  let cb!: TxCallbacks;
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider gate={gate}>
          <Harness onReady={c => (cb = c)} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
  return () => cb;
}

const flush = () => act(async () => {});
const launchAndConfirm = () => {
  fireEvent.click(screen.getByTestId('launch'));
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
};
const closeModal = () => fireEvent.click(screen.getByTestId('transaction-modal-close'));
const hasText = (text: string) => screen.queryAllByText(content => content.includes(text)).length > 0;
const retryButtons = () => screen.queryAllByRole('button', { name: /^(retry|try again)$/i });

describe('the failure the modal shows is the latest one', () => {
  beforeEach(() => {
    i18n.activate('en');
    gateState.signature = false;
  });
  afterEach(() => vi.clearAllMocks());

  it('shows a refusal on a Retry in a session that sent nothing, after an earlier session sent a transaction', () => {
    const cb = renderProvider();
    // An earlier bridge on this page sent its transaction.
    launchAndConfirm();
    act(() => cb().onMutate());
    act(() => cb().onStart('0xearlier'));
    // A success closes the modal on its own.
    act(() => cb().onSuccess('0xearlier'));

    // This one is refused before any write, and refused again, for good, on Retry.
    launchAndConfirm();
    act(() => cb().onError(new TransactionRefusedError("The network isn't synced up to the swap yet."), ''));
    expect(hasText("The network isn't synced up to the swap yet.")).toBe(true);
    fireEvent.click(retryButtons()[0]);
    act(() =>
      cb().onError(new TransactionRefusedError('This swap is too old to continue.', { final: true }), '')
    );

    expect(hasText('This swap is too old to continue.')).toBe(true);
    expect(hasText("The network isn't synced up to the swap yet.")).toBe(false);
    expect(retryButtons()).toHaveLength(0);
  });

  it.each([
    { after: 'a close and a new bridge', next: () => (closeModal(), launchAndConfirm()) },
    {
      after: 'Back',
      next: () => (
        fireEvent.click(screen.getByTestId('transaction-modal-back')),
        fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
      )
    }
  ])(
    'offers Retry on a declined terms signature after $after, though a final refusal came before',
    async ({ next }) => {
      const cb = renderProvider();
      launchAndConfirm();
      act(() =>
        cb().onError(new TransactionRefusedError('This swap is too old to continue.', { final: true }), '')
      );
      expect(retryButtons()).toHaveLength(0);

      gateState.signature = true;
      next();
      await flush();

      expect(hasText('This swap is too old to continue.')).toBe(false);
      expect(hasText('Nothing was sent.')).toBe(false);
      expect(retryButtons().length).toBeGreaterThan(0);
    }
  );
});
