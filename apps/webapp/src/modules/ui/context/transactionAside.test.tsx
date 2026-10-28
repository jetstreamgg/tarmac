import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionConfig } from './transactionContract';

// The modal's width tier, set per test.
const breakpoint = vi.hoisted(() => ({ bpi: 3 }));

// Render the real TransactionProvider + TransactionModal: stub only its chain,
// wallet, batch, and analytics reads (mirrors transactionStepProgression.test).
// The provider needs a live wagmi tree; these suites exercise the transaction
// state machine, so the shared chain switch is stubbed inert.
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
  useIsBatchSupported: () => ({ data: false }),
  useBreakpointIndex: () => ({ bpi: breakpoint.bpi })
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
import { BP } from '@/hooks/ui/useBreakpoint';

i18n.load('en', {});
i18n.activate('en');

let update: ((aside: ReactNode) => void) | undefined;

function Harness({ config }: { config: TransactionConfig }) {
  const { launch, updateModalContent } = useTransaction();
  const started = useRef(false);
  useEffect(() => {
    update = aside => updateModalContent(config.sessionId!, { aside });
    if (started.current) return;
    started.current = true;
    launch(config);
  }, [launch, updateModalContent, config]);
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

const config = (): TransactionConfig => ({
  title: 'Review USDS bridge',
  usdValue: 0,
  supportedChainIds: [1],
  sessionId: 'aside-test',
  steps: ['Bridge USDS'],
  transactionContent: <div data-testid="review-breakdown">breakdown rows</div>,
  aside: <div data-testid="picker">Select bridge type</div>,
  onConfirm: () => {}
});

const confirmButtons = () => screen.getAllByRole('button', { name: /^confirm$/i });

describe('TransactionModal aside (Figma 3964:74437)', () => {
  beforeEach(() => {
    i18n.activate('en');
    breakpoint.bpi = BP.desktop;
  });
  afterEach(() => vi.clearAllMocks());

  it('on desktop, sits beside the review, which keeps the only Confirm', () => {
    renderModal(config());
    const aside = screen.getByTestId('transaction-modal-aside');
    expect(aside.contains(screen.getByTestId('picker'))).toBe(true);
    expect(screen.getByTestId('review-breakdown')).toBeTruthy();
    expect(confirmButtons()).toHaveLength(1);
    expect(aside.contains(confirmButtons()[0])).toBe(false);
  });

  it('below desktop, is not drawn: the flow swaps its review in place instead', () => {
    breakpoint.bpi = BP.lg;
    renderModal(config());
    expect(screen.queryByTestId('transaction-modal-aside')).toBeNull();
    expect(screen.queryByTestId('picker')).toBeNull();
    breakpoint.bpi = BP.sm;
  });

  it('leaves with the review once Confirm moves to the wallet screen', () => {
    renderModal(config());
    fireEvent.click(confirmButtons()[0]);
    expect(screen.queryByTestId('transaction-modal-aside')).toBeNull();
  });

  it('closes when the flow updates it away', () => {
    renderModal(config());
    act(() => update?.(undefined));
    expect(screen.queryByTestId('transaction-modal-aside')).toBeNull();
    expect(screen.getByTestId('review-breakdown')).toBeTruthy();
  });
});
