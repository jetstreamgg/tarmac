import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig } from './transactionContract';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionEntryStep.test.tsx).
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

// Launches `config` on mount once (with the live txCallbacks spread in so the
// status screen can be driven by the test).
function Harness({
  build
}: {
  build: (cb: ReturnType<typeof useTransaction>['txCallbacks']) => TransactionConfig;
}) {
  const { launch, txCallbacks } = useTransaction();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    launch(build(txCallbacks));
  }, [launch, txCallbacks, build]);
  return null;
}

function renderModal(build: (cb: ReturnType<typeof useTransaction>['txCallbacks']) => TransactionConfig) {
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness build={build} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
}

afterEach(() => vi.clearAllMocks());

describe('TransactionModal — per-step title', () => {
  it('shows the first-screen title on a review screen and the transaction-screen title after advancing', () => {
    renderModal(cb => ({
      title: 'Review supply',
      transactionTitle: 'Confirm in the wallet',
      transactionContent: <div data-testid="review-body">review</div>,
      confirmLabel: 'Supply',
      // Mirror a real flow: confirm advances the modal into the wallet/status screen.
      onConfirm: () => cb.onMutate()
    }));

    // Review screen: the base title, not the transaction-screen one.
    expect(screen.queryByText('Review supply')).not.toBeNull();
    expect(screen.queryByText('Confirm in the wallet')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));

    // Wallet/status screen: the title swaps to the transaction-screen title. The
    // INITIALIZED status chip echoes the same copy in its own pill (Figma
    // review) — this single-step flow has no Steps header to hold it, so it
    // renders inline, alongside the modal title.
    expect(screen.queryByText('Review supply')).toBeNull();
    expect(screen.getAllByText('Confirm in the wallet').length).toBeGreaterThan(0);
  });

  it('shows the entry title on an entry screen and the transaction-screen title after confirm', () => {
    renderModal(cb => ({
      title: 'Supply to Sky Savings',
      transactionTitle: 'Confirm in the wallet',
      entry: {
        content: <div data-testid="entry-fields">fields</div>,
        confirmLabel: 'Supply',
        confirmDisabled: false
      },
      onConfirm: () => cb.onMutate()
    }));

    expect(screen.queryByText('Supply to Sky Savings')).not.toBeNull();
    expect(screen.queryByText('Confirm in the wallet')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Supply' }));

    expect(screen.queryByText('Supply to Sky Savings')).toBeNull();
    // Title + the INITIALIZED status chip both read "Confirm in the wallet" here.
    expect(screen.getAllByText('Confirm in the wallet').length).toBeGreaterThan(0);
  });

  it('keeps a single title across both screens when transactionTitle is omitted (existing consumers unchanged)', () => {
    renderModal(cb => ({
      title: 'Upgrade',
      transactionContent: <div data-testid="review-body">review</div>,
      confirmLabel: 'Confirm',
      onConfirm: () => cb.onMutate()
    }));

    expect(screen.queryByText('Upgrade')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // No transactionTitle → the same title still renders on the wallet/status screen.
    expect(screen.queryByText('Upgrade')).not.toBeNull();
  });
});
