import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maxUint256 } from 'viem';
import type { PendleConvertQuote, PendleMarketConfig } from '@/hooks';
import type { PreTransactionGate } from '@/modules/ui/context/preTransactionGate';

// The real Pendle modals end to end — provider, form / redeem launcher, convert
// engine, sequential flow — with wagmi stubbed at its edges. `writeContract` is
// the last stop before the wallet, so what reaches it is what would be signed.
// Quote verification is stubbed to build the call straight from the quote's
// min-out; its own guards are covered in buildVerifiedArgs.test.ts.

i18n.load('en', {});
i18n.activate('en');

const ADDRESS = '0x0000000000000000000000000000000000000001';

const MARKET: PendleMarketConfig = vi.hoisted(() => ({
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33' as const,
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548' as const,
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1' as const,
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927' as const,
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d' as const,
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 4_102_444_800 // 2100, live
}));
const MATURED_MARKET: PendleMarketConfig = { ...MARKET, expiry: 1_700_000_000 };

const quote = (method: string, apiMinOut: bigint, fetchedAt: number): PendleConvertQuote => ({
  method,
  amountOut: apiMinOut + 1_000n,
  apiMinOut,
  effectiveApy: 0.05,
  impliedApy: 0.05,
  priceImpact: -0.0005,
  fetchedAt,
  apiContractParams: [],
  apiContractParamsName: []
});

type WriteRequest = { address: string; functionName: string; args: readonly unknown[] };
type Mutation = { onMutate: () => void; onError: (error: Error) => void };

const h = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    quote: undefined as unknown,
    now: 0,
    listeners,
    writes: [] as WriteRequest[],
    mutation: null as Mutation | null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
});

const notify = () => h.listeners.forEach(listener => listener());
// The live Pendle quote and the staleness clock; setting either re-renders
// their readers the way a poll or a clock tick would.
const setQuote = (next: PendleConvertQuote) => {
  h.quote = next;
  notify();
};
const setNow = (next: number) => {
  h.now = next;
  notify();
};

vi.mock('@/hooks/ui/useNow', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useNow: () => useSyncExternalStore(h.subscribe, () => h.now) };
});

vi.mock('@/hooks/pendle/buildVerifiedArgs', async io => {
  const actual = await io<typeof import('@/hooks/pendle/buildVerifiedArgs')>();
  const { PENDLE_EMPTY_LIMIT, PENDLE_EMPTY_SWAP_DATA, PendleConvertSide } =
    await import('@/hooks/pendle/constants');
  const ZERO = '0x0000000000000000000000000000000000000000' as const;
  return {
    ...actual,
    buildVerifiedArgs: (
      q: PendleConvertQuote,
      known: { receiver: `0x${string}`; market: `0x${string}`; amountIn: bigint; inputToken: `0x${string}` }
    ) =>
      q.method === 'exitPostExpToToken'
        ? {
            side: PendleConvertSide.WITHDRAW,
            functionName: 'exitPostExpToToken',
            args: [
              known.receiver,
              known.market,
              known.amountIn,
              0n,
              {
                tokenOut: MARKET.underlyingToken,
                minTokenOut: q.apiMinOut,
                tokenRedeemSy: MARKET.underlyingToken,
                pendleSwap: ZERO,
                swapData: PENDLE_EMPTY_SWAP_DATA
              }
            ]
          }
        : {
            side: PendleConvertSide.BUY,
            functionName: 'swapExactTokenForPt',
            args: [
              known.receiver,
              known.market,
              q.apiMinOut,
              { guessMin: 0n, guessMax: maxUint256, guessOffchain: 0n, maxIteration: 30n, eps: 10n ** 13n },
              {
                tokenIn: known.inputToken,
                netTokenIn: known.amountIn,
                tokenMintSy: known.inputToken,
                pendleSwap: ZERO,
                swapData: PENDLE_EMPTY_SWAP_DATA
              },
              PENDLE_EMPTY_LIMIT
            ]
          }
  };
});

vi.mock('@/hooks/tokens/useTokenAllowance', () => ({
  useTokenAllowance: () => ({ data: maxUint256, isLoading: false, error: null, mutate: () => {} })
}));

vi.mock('wagmi', async io => ({
  ...(await io<typeof import('wagmi')>()),
  useChainId: () => 1,
  useChains: () => [{ id: 1, name: 'Ethereum' }],
  useConnection: () => ({ address: ADDRESS, chainId: 1, isConnected: true }),
  useAccount: () => ({ address: ADDRESS, chainId: 1, isConnected: true }),
  useSwitchChain: () => stable.switchChain,
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
  // Several engines mount; keep the callbacks of the one that wrote.
  useWriteContract: ({ mutation }: { mutation: Mutation }) => ({
    writeContract: (request: WriteRequest) => {
      h.mutation = mutation;
      h.writes.push(request);
    },
    error: null,
    data: undefined,
    reset: () => {}
  }),
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

// Hook results the modals key effects on must keep their identity across renders.
const stable = vi.hoisted(() => ({
  feeCell: { fee: undefined, state: {}, loading: false },
  read: { isLoading: false, error: undefined, mutate: () => undefined, dataSources: [] },
  switchChain: { switchChainAsync: () => Promise.resolve() },
  networkSwitch: {
    handleSwitchChain: () => {},
    isSwitchPending: false,
    switchVariables: undefined,
    canSwitchChain: true,
    setIsAutoSwitching: () => {},
    setAutoSwitchIntent: () => {}
  },
  analytics: {
    trackWidgetReviewViewed: () => {},
    trackTransactionStarted: () => {},
    trackTransactionCompleted: () => {},
    trackTermsSignatureDeclined: () => {},
    trackNetworkSwitchRequested: () => {},
    trackNetworkSwitchCompleted: () => {}
  },
  analyticsFlow: { startNewFlow: () => {}, getFlowId: () => 'flow-test' },
  usdValue: (_symbol: string, amount: number) => amount,
  widgetAnalytics: () => {},
  batchToggle: [false, () => {}] as const
}));
vi.mock('@/hooks', async io => {
  const actual = await io<typeof import('@/hooks')>();
  const { useSyncExternalStore } = await import('react');
  const balances = { [MARKET.marketAddress]: 1_000_000_000n };
  const tokenBalance = { data: { value: 1_000_000_000n }, isLoading: false, error: null, refetch: () => {} };
  const marketsApi = { [MARKET.marketAddress]: { impliedApy: 0.05, expirySec: MARKET.expiry } };
  return {
    ...actual,
    useIsSafeWallet: () => false,
    useIsBatchSupported: () => ({ data: false, isLoading: false }),
    useIsTouchDevice: () => false,
    usePendleUserPtBalances: () => ({ ...stable.read, data: balances }),
    usePendleMarketsApiData: () => ({ ...stable.read, data: marketsApi }),
    useAllPendleMarketsHistory: () => ({ ...stable.read, data: undefined }),
    useTokenBalance: () => tokenBalance,
    useQuotePendleConvert: (args: { enabled?: boolean }) => {
      const current = useSyncExternalStore(h.subscribe, () => h.quote);
      return { ...stable.read, data: args.enabled === false ? undefined : current };
    }
  };
});
vi.mock('@/modules/ui/hooks/useModalFeeCell', () => ({ useModalFeeCell: () => stable.feeCell }));
vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({ useBatchToggle: () => stable.batchToggle }));
vi.mock('@/modules/pendle/hooks/usePendleUsdValue', () => ({ usePendleUsdValue: () => stable.usdValue }));
vi.mock('@/modules/analytics/hooks/useWidgetAnalytics', () => ({
  useWidgetAnalytics: () => stable.widgetAnalytics
}));
vi.mock('@/modules/ui/components/TokenIcon', () => ({ TokenIcon: () => null }));

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => stable.networkSwitch
}));
vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({ useAppAnalytics: () => stable.analytics }));
vi.mock('@/modules/analytics/context/AnalyticsFlowContext', () => ({
  useAnalyticsFlow: () => stable.analyticsFlow
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
import { PENDLE_QUOTE_TTL_MS } from '@/hooks/pendle/constants';
import { usePendleModal } from '../hooks/usePendleModal';
import { usePendleRedeemModal } from '../hooks/usePendleRedeemModal';

function OpenOnMount({ open }: { open: () => void }) {
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open();
  }, [open]);
  return null;
}
function OpenSupply() {
  const { openSupply } = usePendleModal();
  return <OpenOnMount open={() => openSupply(MARKET)} />;
}
function OpenRedeem() {
  const { openRedeemModal, isPrepared } = usePendleRedeemModal(MATURED_MARKET);
  return isPrepared ? <OpenOnMount open={() => void openRedeemModal()} /> : null;
}

const renderWith = (gate: PreTransactionGate, opener: ReactNode) =>
  render(
    <StrictMode>
      <I18nProvider i18n={i18n}>
        <TooltipProvider>
          <TransactionProvider gate={gate}>{opener}</TransactionProvider>
        </TooltipProvider>
      </I18nProvider>
    </StrictMode>
  );

// A gate whose verdict the test releases, standing in for the Terms signature.
const heldGate = () => {
  let release!: () => void;
  const gate: PreTransactionGate = () =>
    new Promise(resolve => {
      release = () => resolve({ allow: true });
    });
  return { gate, release: () => act(async () => release()) };
};

const supplyAndConfirm = () => {
  fireEvent.change(screen.getByTestId('pendle-modal-amount-input'), { target: { value: '100' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
};

const failLastWrite = () => {
  act(() => h.mutation!.onMutate());
  act(() => h.mutation!.onError(new Error('execution reverted')));
};

const lastToastTitle = () => {
  const renderFn = toastWithCloseMock.mock.calls.at(-1)?.[0] as ((id: string) => ReactNode) | undefined;
  if (!renderFn) return null;
  return render(<I18nProvider i18n={i18n}>{renderFn('toast-id')}</I18nProvider>).container.querySelector('p')
    ?.textContent;
};

const T0 = 1_800_000_000_000;
const MIN_OUT_A = 101_000_000n;
const MIN_OUT_B = 60_000_000n;

describe('Pendle — deferred dispatch', () => {
  beforeEach(() => {
    h.writes = [];
    h.mutation = null;
    h.now = T0;
    h.quote = quote('swapExactTokenForPt', MIN_OUT_A, T0);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('buy', () => {
    it('sends the reviewed min-out when the quote holds through the gate', async () => {
      const { gate, release } = heldGate();
      renderWith(gate, <OpenSupply />);

      supplyAndConfirm();
      await release();

      expect(h.writes).toHaveLength(1);
      expect(h.writes[0].args[2]).toBe(MIN_OUT_A);
    });

    it('sends nothing when the quote moves while the gate holds', async () => {
      const { gate, release } = heldGate();
      renderWith(gate, <OpenSupply />);

      supplyAndConfirm();
      act(() => setQuote(quote('swapExactTokenForPt', MIN_OUT_B, T0)));
      await release();

      expect(h.writes).toHaveLength(0);
      expect(lastToastTitle()).toBe('Transaction details changed');
    });

    it('sends nothing on Retry once the quote moved', () => {
      renderWith(() => ({ allow: true }), <OpenSupply />);

      supplyAndConfirm();
      expect(h.writes).toHaveLength(1);
      failLastWrite();
      act(() => setQuote(quote('swapExactTokenForPt', MIN_OUT_B, T0)));
      fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));

      expect(h.writes).toHaveLength(1);
      expect(lastToastTitle()).toBe('Transaction details changed');
    });

    it('goes back to review instead of hanging when the quote expires while the gate holds', async () => {
      const { gate, release } = heldGate();
      renderWith(gate, <OpenSupply />);

      supplyAndConfirm();
      act(() => setNow(T0 + PENDLE_QUOTE_TTL_MS + 1));
      await release();

      expect(h.writes).toHaveLength(0);
      expect(lastToastTitle()).toBe('Transaction details changed');
      expect(screen.getByRole('button', { name: 'Review' })).toBeTruthy();
    });
  });

  describe('redeem', () => {
    beforeEach(() => {
      h.quote = quote('exitPostExpToToken', MIN_OUT_A, T0);
    });

    it('retries with the reviewed min-out when the quote holds', () => {
      renderWith(() => ({ allow: true }), <OpenRedeem />);

      fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
      expect(h.writes).toHaveLength(1);
      failLastWrite();
      fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));

      expect(h.writes).toHaveLength(2);
      expect(h.writes[1].args).toEqual(h.writes[0].args);
    });

    it('sends nothing on Retry once the quote moved', () => {
      renderWith(() => ({ allow: true }), <OpenRedeem />);

      fireEvent.click(screen.getByRole('button', { name: 'Claim' }));
      expect(h.writes).toHaveLength(1);
      failLastWrite();
      act(() => setQuote(quote('exitPostExpToToken', MIN_OUT_B, T0)));
      fireEvent.click(screen.getByRole('button', { name: /retry|try again/i }));

      expect(h.writes).toHaveLength(1);
      expect(lastToastTitle()).toBe('Transaction details changed');
    });
  });
});
