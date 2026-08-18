import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig } from './transactionContract';
import type { PreflightHook, PreTransactionGate, TransactionPreflight } from './preTransactionGate';

// Same harness as transactionGate.test.tsx: the real TransactionProvider +
// TransactionModal, with only chain/wallet/batch/analytics reads stubbed.
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
  useAnalyticsFlow: () => ({ startNewFlow: vi.fn() })
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

// Controllable preflight double: set `preflightState` before rendering; the
// hook double records every context it was called with.
let preflightState: TransactionPreflight;
let preflightContexts: Array<{ usdValue: number | undefined; active: boolean }>;
const usePreflightFake: PreflightHook = context => {
  preflightContexts.push(context);
  return preflightState;
};

function Harness({ config }: { config: TransactionConfig }) {
  const { launch } = useTransaction();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch(config);
  }, [launch, config]);
  return null;
}

function renderWithPreflight(config: TransactionConfig, gate?: PreTransactionGate) {
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider gate={gate} usePreflight={usePreflightFake}>
          <Harness config={config} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
}

const flush = () => act(async () => {});

const BLOCKED_MESSAGE = 'This wallet didn’t pass the enhanced verification.';
const blocked = (): TransactionPreflight => ({ kind: 'blocked', message: BLOCKED_MESSAGE });

describe('TransactionProvider enhanced-screening preflight', () => {
  beforeEach(() => {
    i18n.activate('en');
    preflightState = { kind: 'clear' };
    preflightContexts = [];
  });
  afterEach(() => vi.clearAllMocks());

  it('hands the hook the live usdValue and session activity', () => {
    renderWithPreflight({ title: 'Supply', usdValue: 300_000, onConfirm: vi.fn() });

    const last = preflightContexts.at(-1);
    expect(last).toEqual({ usdValue: 300_000, active: true });
  });

  it('clear: the review confirm fires normally and no message is shown', () => {
    const onConfirm = vi.fn();
    renderWithPreflight({ title: 'Supply', usdValue: 100, onConfirm });

    expect(screen.queryByTestId('transaction-preflight-blocked')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('blocked: the review confirm is disabled and the message renders above it', () => {
    preflightState = blocked();
    const onConfirm = vi.fn();
    renderWithPreflight({ title: 'Supply', usdValue: 300_000, onConfirm });

    expect(screen.getByTestId('transaction-preflight-blocked').textContent).toContain(
      'didn’t pass the enhanced verification'
    );
    const confirm = screen.getByRole('button', { name: /confirm/i });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('pending: the review confirm is held (disabled), no message yet', () => {
    preflightState = { kind: 'pending' };
    const onConfirm = vi.fn();
    renderWithPreflight({ title: 'Supply', usdValue: 300_000, onConfirm });

    expect(screen.queryByTestId('transaction-preflight-blocked')).toBeNull();
    const confirm = screen.getByRole('button', { name: /confirm/i });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('blocked entry-only flow: primary and secondary CTAs are both disabled', () => {
    preflightState = blocked();
    const onConfirm = vi.fn();
    const onSecondaryConfirm = vi.fn();
    renderWithPreflight({
      title: 'Claim rewards',
      usdValue: 300_000,
      entry: {
        content: <div>claim body</div>,
        confirmLabel: 'Claim & Restake',
        secondaryConfirmLabel: 'Claim'
      },
      onConfirm,
      onSecondaryConfirm
    });

    const primary = screen.getByRole('button', { name: 'Claim & Restake' });
    const secondary = screen.getByRole('button', { name: 'Claim' });
    expect(primary).toHaveProperty('disabled', true);
    expect(secondary).toHaveProperty('disabled', true);
    fireEvent.click(primary);
    fireEvent.click(secondary);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onSecondaryConfirm).not.toHaveBeenCalled();
  });

  it('blocked three-screen flow: the entry still advances to review, where the firing confirm is held', () => {
    preflightState = blocked();
    const onConfirm = vi.fn();
    renderWithPreflight({
      title: 'Supply',
      reviewTitle: 'Review supply',
      usdValue: 300_000,
      entry: { content: <div>amount input</div>, confirmLabel: 'Review' },
      transactionContent: <div>review breakdown</div>,
      onConfirm
    });

    // The message already shows on the entry (the block is address-level)…
    expect(screen.getByTestId('transaction-preflight-blocked')).not.toBeNull();
    // …but the advance CTA stays live: it only moves to the review screen.
    const review = screen.getByRole('button', { name: 'Review' });
    expect(review).toHaveProperty('disabled', false);
    fireEvent.click(review);
    expect(onConfirm).not.toHaveBeenCalled();

    // The review screen's confirm is the firing CTA — held.
    const confirm = screen.getByRole('button', { name: /confirm/i });
    expect(confirm).toHaveProperty('disabled', true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('the gate receives the config usdValue at fire time', async () => {
    const gate = vi.fn(() => ({ allow: true }));
    renderWithPreflight({ title: 'Supply', usdValue: 275_000, onConfirm: vi.fn() }, gate);

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await flush();
    expect(gate).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'confirm', usdValue: 275_000 }));
  });
});
