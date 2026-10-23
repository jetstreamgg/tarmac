/// <reference types="vite/client" />

import { act, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'viem/chains';
import { pendleAnalyticsData } from '@/modules/pendle/lib/pendleAnalyticsData';
import type { PendleConvertQuote, PendleMarketConfig } from '@/hooks';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const MATURED_MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  slug: 'pt-usdg',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548',
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1',
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927',
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1_700_000_000 // matured (2023)
};

const PT_BALANCE = 1_500_000n; // 1.5 PT-USDG (6dp)

const QUOTE: PendleConvertQuote = {
  method: 'exitPostExpToToken',
  amountOut: 1_499_500n,
  apiMinOut: 1_484_505n,
  effectiveApy: 0.054,
  impliedApy: 0.06,
  priceImpact: -0.0012,
  aggregatorType: 'KYBERSWAP',
  feeUsd: 1.23,
  fetchedAt: Date.now(),
  apiContractParams: [],
  apiContractParamsName: []
};

const hoisted = vi.hoisted(() => ({
  launchMock: vi.fn(),
  mutateAllowance: vi.fn(),
  reset: vi.fn(),
  settle: null as { reset: unknown; onCleared: unknown } | null,
  modalProps: vi.fn(),
  matured: true,
  // Swappable execute fn so tests can prove the latest one fires through onConfirm.
  currentExecute: (() => undefined) as () => void,
  // Swappable USD value fn (default ≈$1/token) so a test can force "no value".
  valueUsd: ((_symbol: string, amount: number) => amount) as (
    symbol: string,
    amount: number
  ) => number | undefined,
  // Click-time network switch collaborators.
  chainId: 1,
  canSwitchChain: true,
  switchChainAsyncMock: vi.fn(async () => undefined as unknown),
  setIsAutoSwitchingMock: vi.fn(),
  setAutoSwitchIntentMock: vi.fn(),
  trackSwitchRequestedMock: vi.fn(),
  trackSwitchCompletedMock: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => hoisted.chainId,
    useChains: () => [{ id: 1, name: 'Ethereum' }],
    useSwitchChain: () => ({ switchChainAsync: hoisted.switchChainAsyncMock }),
    useConnection: () => ({ address: '0x1111111111111111111111111111111111111111' })
  };
});

vi.mock('@/modules/ui/context/NetworkSwitchContext', () => ({
  useNetworkSwitch: () => ({
    isSwitchingNetwork: false,
    setIsSwitchingNetwork: () => undefined,
    isAutoSwitching: false,
    setIsAutoSwitching: hoisted.setIsAutoSwitchingMock,
    autoSwitchIntent: null,
    setAutoSwitchIntent: hoisted.setAutoSwitchIntentMock,
    canSwitchChain: hoisted.canSwitchChain
  })
}));

vi.mock('@/modules/analytics/hooks/useAppAnalytics', () => ({
  useAppAnalytics: () => ({
    trackNetworkSwitchRequested: hoisted.trackSwitchRequestedMock,
    trackNetworkSwitchCompleted: hoisted.trackSwitchCompletedMock
  })
}));

vi.mock('@/modules/ui/hooks/useBatchToggle', () => ({
  useBatchToggle: () => [true, () => undefined]
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    isMarketMatured: () => hoisted.matured,
    useTokenAllowance: () => ({ data: 0n, isLoading: false, error: null, mutate: hoisted.mutateAllowance }),
    useNetworkFee: () => ({
      data: undefined,
      isLoading: false,
      error: null,
      mutate: () => {},
      dataSources: []
    }),
    useIsBatchSupported: () => ({ data: true, isLoading: false }),
    usePendleUserPtBalances: () => ({
      data: { [MATURED_MARKET.marketAddress]: PT_BALANCE },
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    useQuotePendleConvert: () => ({
      data: QUOTE,
      isLoading: false,
      error: undefined,
      mutate: () => undefined,
      dataSources: []
    }),
    useBatchPendleConvert: () => {
      // Snapshot the current execute at render time so each render's writeHook
      // closes over the args from that render — matches the real hook's
      // semantics (a fresh execute closure per render).
      const captured = hoisted.currentExecute;
      return {
        execute: () => captured(),
        reset: hoisted.reset,
        prepared: true,
        isLoading: false,
        error: undefined,
        currentCallIndex: 0
      };
    }
  };
});

vi.mock('@/modules/pendle/hooks/usePendleSlippage', () => ({
  usePendleSlippage: () => ({
    slippage: 0.01,
    setSlippage: () => undefined,
    defaultSlippage: 0.01
  })
}));

// Stub the USD value fn so the test doesn't pull in usePrices()/wagmi reads.
// Reads the swappable hoisted fn (default ≈$1/token).
vi.mock('@/modules/pendle/hooks/usePendleUsdValue', () => ({
  usePendleUsdValue: () => hoisted.valueUsd
}));

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({ launch: hoisted.launchMock }),
  useSettleOnEnd: (reset: unknown, onCleared: unknown) => {
    hoisted.settle = { reset, onCleared };
  },
  useSession: () => ({
    txCallbacks: {
      onMutate: () => undefined,
      onStart: () => undefined,
      onSuccess: () => undefined,
      onError: () => undefined
    },
    status: 'idle'
  })
}));

vi.mock('@/modules/ui/components/TransactionModal', async () =>
  (await import('@/modules/ui/components/transactionModalSpy.testing')).transactionModalSpy(
    hoisted.modalProps
  )
);

vi.mock('../../components/PendleRedeem', () => ({
  PendleRedeem: () => null
}));

import { usePendleRedeemModal } from '../usePendleRedeemModal';
import { PendleRedeemFlow } from '../../components/PendleRedeemFlow';

function renderComponent(ui: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<I18nProvider i18n={i18n}>{ui}</I18nProvider>);
  });
  return {
    container,
    rerender: (next: ReactNode) => {
      act(() => {
        root.render(<I18nProvider i18n={i18n}>{next}</I18nProvider>);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

const UNDERLYING = {
  name: 'USDG',
  symbol: 'USDG',
  decimals: 6,
  color: '#00C2A1',
  address: { [mainnet.id]: MATURED_MARKET.underlyingToken }
};
const Flow = () => (
  <PendleRedeemFlow market={MATURED_MARKET} initialOutputToken={UNDERLYING} onOutputTokenChange={() => {}} />
);
const lastProps = () => hoisted.modalProps.mock.calls.at(-1)![0];

describe('PendleRedeemFlow analytics', () => {
  beforeEach(() => {
    hoisted.modalProps.mockClear();
    hoisted.matured = true;
    hoisted.valueUsd = (_symbol: string, amount: number) => amount;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('names the quoted receive amount in the success toast', () => {
    const { unmount } = renderComponent(<Flow />);
    // QUOTE.amountOut = 1_499_500n at 6dp → 1.5 of the default output (the underlying).
    expect(lastProps().toast).toEqual({
      loading: 'Claiming your matured position',
      success: 'Claimed 1.50 USDG',
      error: 'Claim failed'
    });
    unmount();
  });

  it('reports widgetName=fixed, flow=redeem, action=redeem', () => {
    const { unmount } = renderComponent(<Flow />);
    const { analytics } = lastProps();
    expect(analytics?.widgetName).toBe('fixed');
    expect(analytics?.flow).toBe('redeem');
    expect(analytics?.action).toBe('redeem');
    unmount();
  });

  it('emits analytics.data shaped identically to pendleAnalyticsData(redeem)', () => {
    const { unmount } = renderComponent(<Flow />);
    const ptToken = {
      name: 'PT-USDG',
      symbol: 'PT-USDG',
      decimals: 6,
      color: '#1BE3C2',
      address: { [mainnet.id]: MATURED_MARKET.ptToken }
    };
    const expected = pendleAnalyticsData({
      market: MATURED_MARKET,
      side: 'redeem',
      originToken: ptToken,
      targetToken: UNDERLYING,
      amountFromBigint: PT_BALANCE,
      amountToBigint: QUOTE.amountOut,
      fromDecimals: MATURED_MARKET.underlyingDecimals,
      toDecimals: MATURED_MARKET.underlyingDecimals,
      slippage: 0.01,
      quote: QUOTE,
      isBatchTx: true
    });
    const data = lastProps().analytics?.data ?? {};
    for (const [key, value] of Object.entries(expected)) {
      expect(data[key]).toEqual(value);
    }
    unmount();
  });

  it('emits a strictly negative amount = USD value of the redeemed output leg', () => {
    // Output = QUOTE.amountOut (1_499_500n at 6dp) = 1.4995, valued ~$1/token by the
    // stubbed value fn, emitted negative as a withdrawal.
    const { unmount } = renderComponent(<Flow />);
    const amount = lastProps().analytics?.data?.amount as number;
    expect(amount).toBeLessThan(0);
    expect(Math.abs(amount)).toBeCloseTo(1.4995, 6);
    unmount();
  });

  it('omits amount when the output leg cannot be valued (valueUsd → undefined)', () => {
    hoisted.valueUsd = () => undefined;
    const { unmount } = renderComponent(<Flow />);
    expect(lastProps().analytics?.widgetName).toBe('fixed');
    expect('amount' in (lastProps().analytics?.data ?? {})).toBe(false);
    unmount();
  });

  it('includes module=pendle and the consolidated Pendle fields', () => {
    const { unmount } = renderComponent(<Flow />);
    const data = lastProps().analytics?.data ?? {};
    expect(data.module).toBe('pendle');
    expect(data.productAddress).toBe(MATURED_MARKET.marketAddress);
    expect(data.ptAddress).toBe(MATURED_MARKET.ptToken);
    expect(data.expiry).toBe(MATURED_MARKET.expiry);
    expect(data.aggregatorType).toBe('KYBERSWAP');
    expect(data.feeUsd).toBe(1.23);
    unmount();
  });

  it('resets the engine as the session ends, then refreshes the PT allowance, so a mined approve is not asked for again', () => {
    renderComponent(<Flow />);
    expect(hoisted.settle).toEqual({ reset: hoisted.reset, onCleared: hoisted.mutateAllowance });
  });

  it("confirms with the latest render's execute", () => {
    const executeAtMount = vi.fn();
    hoisted.currentExecute = executeAtMount;
    const { rerender, unmount } = renderComponent(<Flow />);

    const executeAfterChange = vi.fn();
    hoisted.currentExecute = executeAfterChange;
    rerender(<Flow />);

    act(() => lastProps().onConfirm());
    expect(executeAtMount).not.toHaveBeenCalled();
    expect(executeAfterChange).toHaveBeenCalledTimes(1);
    unmount();
  });
});

describe('usePendleRedeemModal network switch', () => {
  beforeEach(() => {
    hoisted.launchMock.mockClear();
    hoisted.matured = true;
    hoisted.chainId = 1;
    hoisted.canSwitchChain = true;
    hoisted.switchChainAsyncMock.mockReset();
    hoisted.switchChainAsyncMock.mockResolvedValue(undefined);
    hoisted.setIsAutoSwitchingMock.mockClear();
    hoisted.setAutoSwitchIntentMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // A real click, not a render-time capture — reassigning an outer variable
  // during render trips react-hooks/globals, and the click path is what ships.
  const Capture = () => {
    const { openRedeemModal } = usePendleRedeemModal(MATURED_MARKET);
    return <button data-testid="open-redeem" onClick={() => void openRedeemModal()} />;
  };
  const clickOpen = (container: HTMLElement) =>
    act(async () => {
      container
        .querySelector('[data-testid="open-redeem"]')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

  it('opens directly on the pendle chain without touching the wallet', async () => {
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    expect(hoisted.switchChainAsyncMock).not.toHaveBeenCalled();
    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('switches the wallet to mainnet first when clicked off-chain, flagged automatic', async () => {
    hoisted.chainId = 8453; // Base
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    expect(hoisted.setIsAutoSwitchingMock).toHaveBeenCalledWith(true);
    expect(hoisted.switchChainAsyncMock).toHaveBeenCalledWith({ chainId: 1 });
    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('a rejected switch opens nothing and resets the auto flags — the click stays retryable', async () => {
    hoisted.chainId = 8453;
    hoisted.switchChainAsyncMock.mockRejectedValueOnce(new Error('User rejected the request'));
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    expect(hoisted.launchMock).not.toHaveBeenCalled();
    expect(hoisted.setIsAutoSwitchingMock).toHaveBeenLastCalledWith(false);
    expect(hoisted.setAutoSwitchIntentMock).toHaveBeenLastCalledWith(null);
    view.unmount();
  });

  it('does nothing off-chain in a Safe — it cannot switch from the dapp (APP-486)', async () => {
    hoisted.chainId = 8453;
    hoisted.canSwitchChain = false;
    const view = renderComponent(<Capture />);
    await clickOpen(view.container);
    expect(hoisted.switchChainAsyncMock).not.toHaveBeenCalled();
    expect(hoisted.launchMock).not.toHaveBeenCalled();
    view.unmount();
  });
});
