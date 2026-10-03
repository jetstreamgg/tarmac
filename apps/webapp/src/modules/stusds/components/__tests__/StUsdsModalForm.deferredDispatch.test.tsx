import { StrictMode, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maxUint256, parseUnits } from 'viem';
import type { PreTransactionGate } from '@/modules/ui/context/preTransactionGate';

// The real stUSDS modal end to end — provider, form, launch hook, Curve engine,
// sequential flow — with wagmi stubbed at its edges. `writeContract` is the
// last stop before the wallet, so what reaches it is what would be signed.

i18n.load('en', {});
i18n.activate('en');

const ADDRESS = '0x0000000000000000000000000000000000000001';
const AMOUNT = parseUnits('100000', 18);
const QUOTE_A = parseUnits('92000', 18);
const QUOTE_B = parseUnits('35000', 18);
// The rate-driven drift between polls: a slightly better quote.
const QUOTE_A_UP = parseUnits('92001', 18);

type WriteRequest = { address: string; functionName: string; args: readonly unknown[] };
type Mutation = { onMutate: () => void; onError: (error: Error) => void };

const h = vi.hoisted(() => ({
  quote: 0n,
  listeners: new Set<() => void>(),
  writes: [] as WriteRequest[],
  mutation: null as Mutation | null,
  models: new Map<bigint, unknown>()
}));

// The live Curve quote the form reads; setting it re-renders the form the way a poll would.
const setQuote = (quote: bigint) => {
  h.quote = quote;
  h.listeners.forEach(listener => listener());
};
const useQuote = () =>
  useSyncExternalStore(
    listener => {
      h.listeners.add(listener);
      return () => h.listeners.delete(listener);
    },
    () => h.quote
  );

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => 1,
  useChains: () => [{ id: 1, name: 'Ethereum' }],
  useConnection: () => ({ address: ADDRESS, chainId: 1, isConnected: true }),
  useAccount: () => ({ address: ADDRESS, chainId: 1, isConnected: true }),
  useSimulateContract: (params: {
    address?: string;
    functionName?: string;
    args?: readonly unknown[];
    query?: { enabled?: boolean };
  }) => ({
    data:
      params.query?.enabled && params.address
        ? { request: { address: params.address, functionName: params.functionName, args: params.args } }
        : undefined,
    isLoading: false,
    error: null
  }),
  // Both Curve engines mount; keep the callbacks of the one that wrote.
  useWriteContract: ({ mutation }: { mutation: Mutation }) => {
    return {
      writeContract: (request: WriteRequest) => {
        h.mutation = mutation;
        h.writes.push(request);
      },
      error: null,
      data: undefined,
      reset: () => {}
    };
  },
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
    error: null,
    failureReason: null
  }),
  useSendCalls: () => ({ sendCalls: vi.fn(), data: undefined, error: null, reset: () => {} }),
  useWaitForCallsStatus: () => ({ data: undefined, isSuccess: false, error: null, failureReason: null })
}));

vi.mock('@/hooks/shared/useWaitForSafeTxHash', () => ({
  useWaitForSafeTxHash: () => ({ transactionHash: undefined, isSafeApp: false })
}));
vi.mock('@/hooks/shared/useIsBatchSupported', () => ({
  useIsBatchSupported: () => ({ data: false, isLoading: false })
}));
vi.mock('@/hooks/stusds/providers/useCurveAllowance', () => ({
  useCurveAllowance: () => ({ data: maxUint256, hasAllowance: true, error: null, mutate: () => {} })
}));
vi.mock('@/hooks/stusds/providers/useCurvePoolData', () => ({
  useCurvePoolData: () => ({ data: { tokenIndices: { usds: 0, stUsds: 1 } } })
}));

const idleEngine = {
  execute: () => {},
  prepared: false,
  isLoading: false,
  error: null,
  calls: [],
  currentCallIndex: 0,
  reset: () => {}
};
vi.mock('@/hooks', async io => ({
  ...(await io<typeof import('@/hooks')>()),
  useIsSafeWallet: () => false,
  useIsBatchSupported: () => ({ data: false, isLoading: false }),
  useIsTouchDevice: () => false,
  useStUsdsAllowance: () => ({ data: 0n }),
  useBatchStUsdsDeposit: () => idleEngine,
  useStUsdsWithdraw: () => idleEngine
}));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => [false, () => {}] }));
const feeCell = vi.hoisted(() => ({ fee: undefined, state: {}, loading: false }));
vi.mock('@/modules/ui/hooks/useModalFeeCell', () => ({ useModalFeeCell: () => feeCell }));

// The form model with the Curve route selected and a live quote.
vi.mock('../../hooks/useStUsdsTransactionForm', async io => {
  const actual = await io<typeof import('../../hooks/useStUsdsTransactionForm')>();
  const { StUsdsProviderType } = await import('@/hooks');
  return {
    ...actual,
    // One model object per quote: the real hook's outputs are memoized, and
    // fresh objects every render would loop the body's live push.
    useStUsdsTransactionForm: () => {
      const quote = useQuote();
      const cached = h.models.get(quote) as ReturnType<typeof actual.useStUsdsTransactionForm> | undefined;
      if (cached) return cached;
      const model = {
        isConnected: true,
        isSupply: true,
        value: '100000',
        amount: AMOUNT,
        available: AMOUNT,
        isZero: false,
        insufficient: false,
        blocked: false,
        amountReady: true,
        rate: 0.05,
        position: 0n,
        engineParams: {
          flow: 'supply',
          amount: AMOUNT,
          selectedProvider: StUsdsProviderType.CURVE,
          expectedOutput: quote
        },
        providerSelection: {
          selectedProvider: StUsdsProviderType.CURVE,
          selectedQuote: undefined,
          isLoading: false,
          allProvidersBlocked: false
        },
        priceImpactBps: undefined,
        needsImpactAcknowledgement: false,
        impactAccepted: false,
        setImpactAccepted: () => {},
        needsRiskAcknowledgement: false,
        riskAccepted: false,
        acceptRisk: () => {},
        toast: { loading: 'l', success: 's', error: 'e' },
        transactionScreenContent: null,
        onInput: () => {},
        setPercentAmount: () => {}
      };
      h.models.set(quote, model);
      return model;
    }
  };
});
vi.mock('../StUsdsProviderNotice', () => ({ StUsdsProviderNotice: () => null }));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    handleSwitchChain: vi.fn(),
    isSwitchPending: false,
    switchVariables: undefined,
    canSwitchChain: true
  })
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({
    trackWidgetReviewViewed: vi.fn(),
    trackTransactionStarted: vi.fn(),
    trackTransactionCompleted: vi.fn(),
    trackTermsSignatureDeclined: vi.fn()
  })
}));
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

import { TooltipProvider } from '@/components/ui/tooltip';
import { TransactionProvider } from '@/modules/ui/context/TransactionContext';
import { useStUsdsModal } from '../../hooks/useStUsdsModal';

function OpenSupply() {
  const { openSupply } = useStUsdsModal();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openSupply();
  }, [openSupply]);
  return null;
}

const renderModal = (gate: PreTransactionGate) =>
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TooltipProvider>
          <TransactionProvider gate={gate}>
            <OpenSupply />
          </TransactionProvider>
        </TooltipProvider>
      </I18nProvider>
    </StrictMode>
  );

const minOutOf = (write: WriteRequest) => write.args[3] as bigint;

const toReviewAndConfirm = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
};

// The send-back lands on the review (Confirm), not the editable entry (Review).
const expectOnReview = () => {
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Review' })).toBeNull();
};

const lastToastTitle = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)?.[0] as ((id: string) => ReactNode) | undefined;
  if (!renderFn) return null;
  return render(<I18nProvider i18n={i18n}>{renderFn('toast-id')}</I18nProvider>).container.querySelector('p')
    ?.textContent;
};

// A gate whose verdict the test releases, standing in for the Terms signature.
const heldGate = () => {
  let release!: () => void;
  const gate: PreTransactionGate = () =>
    new Promise(resolve => {
      release = () => resolve({ allow: true });
    });
  return { gate, release: () => act(async () => release()) };
};

describe('stUSDS Curve supply — deferred dispatch', () => {
  beforeEach(() => {
    h.writes = [];
    h.mutation = null;
    h.quote = QUOTE_A;
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('sends the reviewed min-out when the quote holds through the gate', async () => {
    const { gate, release } = heldGate();
    renderModal(gate);

    toReviewAndConfirm();
    await release();

    expect(h.writes).toHaveLength(1);
    expect(h.writes[0].functionName).toBe('exchange');
    expect(h.writes[0].args[2]).toBe(AMOUNT);
  });

  it('sends nothing when the quote moves while the gate holds', async () => {
    const reviewed = heldGate();
    renderModal(reviewed.gate);

    toReviewAndConfirm();
    act(() => setQuote(QUOTE_B));
    await reviewed.release();

    expect(h.writes).toHaveLength(0);
    expect(lastToastTitle()).toBe('Transaction details changed');
    expectOnReview();
  });

  it('sends the tighter min-out when the quote improves while the gate holds', async () => {
    // The min-out the reviewed quote produces, as the baseline.
    const held = heldGate();
    renderModal(held.gate);
    toReviewAndConfirm();
    await held.release();
    const reviewedMinOut = minOutOf(h.writes[0]);
    cleanup();
    h.writes = [];

    const improved = heldGate();
    renderModal(improved.gate);
    toReviewAndConfirm();
    act(() => setQuote(QUOTE_A_UP));
    await improved.release();

    expect(h.writes).toHaveLength(1);
    expect(minOutOf(h.writes[0])).toBeGreaterThan(reviewedMinOut);
    expect(toastWithCloseMock).not.toHaveBeenCalled();
  });

  it('retries with the reviewed min-out when the quote holds', () => {
    renderModal(() => ({ allow: true }));

    toReviewAndConfirm();
    expect(h.writes).toHaveLength(1);
    const reviewedMinOut = minOutOf(h.writes[0]);

    act(() => h.mutation!.onMutate());
    act(() => h.mutation!.onError(new Error('execution reverted')));
    fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));

    expect(h.writes).toHaveLength(2);
    expect(minOutOf(h.writes[1])).toBe(reviewedMinOut);
  });

  it('sends nothing on Retry once the quote moved', () => {
    renderModal(() => ({ allow: true }));

    toReviewAndConfirm();
    act(() => h.mutation!.onMutate());
    act(() => h.mutation!.onError(new Error('execution reverted')));
    act(() => setQuote(QUOTE_B));
    fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));

    expect(h.writes).toHaveLength(1);
    expect(lastToastTitle()).toBe('Transaction details changed');
    expectOnReview();
  });
});
