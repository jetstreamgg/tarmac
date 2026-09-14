import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig } from './transactionContract';

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionStepProgression.test).
// The provider needs a live wagmi tree; these suites exercise the transaction
// state machine, so the shared chain switch is stubbed inert.
vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({ handleSwitchChain: vi.fn(), isSwitchPending: false, switchVariables: undefined })
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

function renderModal(config: TransactionConfig) {
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TransactionProvider>
          <Harness config={config} />
        </TransactionProvider>
      </I18nProvider>
    </StrictMode>
  );
}

// Advances review → transaction by clicking the Confirm CTA (not the back/close icons).
const clickConfirm = () => fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

const reviewConfig = (): TransactionConfig => ({
  title: 'Review supply',
  usdValue: 0,
  supportedChainIds: [1],
  transactionTitle: 'Confirm in the wallet',
  steps: ['Approve USDS', 'Supply USDS'],
  transactionContent: <div data-testid="review-breakdown">breakdown rows</div>,
  transactionScreenContent: <div data-testid="confirm-summary">supply amount summary</div>,
  // onConfirm is a no-op, so txStatus stays IDLE — the transaction screen is
  // reachable without a wallet round-trip, and back/close stay enabled.
  onConfirm: () => {}
});

describe('TransactionModal — per-screen content + chrome (Figma "Confirm in the wallet")', () => {
  beforeEach(() => i18n.activate('en'));
  afterEach(() => vi.clearAllMocks());

  it('shows the breakdown + no steps on the review screen, then the compact summary + steps on the wallet screen', () => {
    renderModal(reviewConfig());

    // Review screen: breakdown shown, summary hidden, steps NOT yet shown.
    expect(screen.getByText('Review supply')).toBeTruthy();
    expect(screen.queryByTestId('review-breakdown')).not.toBeNull();
    expect(screen.queryByTestId('confirm-summary')).toBeNull();
    expect(screen.queryByText('Approve USDS')).toBeNull();

    clickConfirm();

    // Wallet/status screen: title flips, the breakdown is replaced by the compact
    // summary, and the step indicators appear.
    expect(screen.getByText('Confirm in the wallet')).toBeTruthy();
    expect(screen.queryByTestId('review-breakdown')).toBeNull();
    expect(screen.queryByTestId('confirm-summary')).not.toBeNull();
    expect(screen.queryByText('Approve USDS')).not.toBeNull();
    expect(screen.queryByText('Supply USDS')).not.toBeNull();
  });

  it('renders the wallet-screen hero above the Actions step list (Figma order)', () => {
    renderModal(reviewConfig());
    clickConfirm();

    const hero = screen.getByTestId('confirm-summary');
    const actions = screen.getByText('Actions');
    // The hero must precede the step list in document order.
    expect(hero.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('falls back to the review body on the wallet screen when no compact summary is supplied (back-compat)', () => {
    const { transactionScreenContent, ...rest } = reviewConfig();
    void transactionScreenContent;
    renderModal(rest);

    clickConfirm();

    // No transactionScreenContent → the review body still renders on the wallet
    // screen, exactly as before this change (preserves Pendle's current modal).
    expect(screen.queryByTestId('review-breakdown')).not.toBeNull();
  });

  it('header back arrow returns from the wallet screen to the review screen', () => {
    renderModal(reviewConfig());
    clickConfirm();
    expect(screen.getByText('Confirm in the wallet')).toBeTruthy();

    fireEvent.click(screen.getByTestId('transaction-modal-back'));

    // Back to the first screen: title + breakdown restored, summary + steps gone.
    expect(screen.getByText('Review supply')).toBeTruthy();
    expect(screen.queryByTestId('review-breakdown')).not.toBeNull();
    expect(screen.queryByTestId('confirm-summary')).toBeNull();
    expect(screen.queryByText('Approve USDS')).toBeNull();
  });

  it('draws no back arrow on the flow’s first screen (Figma 859:36036: title + close only)', () => {
    renderModal(reviewConfig());
    expect(screen.getByText('Review supply')).toBeTruthy();

    expect(screen.queryByTestId('transaction-modal-back')).toBeNull();
  });
});
