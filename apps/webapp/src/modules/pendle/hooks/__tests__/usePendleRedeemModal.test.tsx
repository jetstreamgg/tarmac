/// <reference types="vite/client" />

import { act, useEffect, type ReactNode } from 'react';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mainnet } from 'viem/chains';
import { pendleAnalyticsData } from '@/widgets';
import type { PendleConvertQuote, PendleMarketConfig } from '@/hooks';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
i18n.load('en', {});
i18n.activate('en');

const MATURED_MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
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
  matured: true,
  // Swappable execute fn so tests can prove the latest one fires through onConfirm.
  currentExecute: (() => undefined) as () => void,
  // Swappable USD value fn (default ≈$1/token) so a test can force "no value".
  valueUsd: ((_symbol: string, amount: number) => amount) as (
    symbol: string,
    amount: number
  ) => number | undefined
}));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    isMarketMatured: () => hoisted.matured,
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
        reset: () => undefined,
        prepared: true,
        isLoading: false,
        error: undefined,
        currentCallIndex: 0
      };
    }
  };
});

vi.mock('@/widgets', async importOriginal => {
  const actual = await importOriginal<typeof import('@/widgets')>();
  return {
    ...actual,
    // Heavy components inside the modal — render-irrelevant for these assertions.
    PendleConfigMenu: () => null,
    usePendleSlippage: () => ({
      slippage: 0.01,
      setSlippage: () => undefined,
      defaultSlippage: 0.01
    }),
    // Stub the USD value fn so the test doesn't pull in usePrices()/wagmi reads.
    // Reads the swappable hoisted fn (default ≈$1/token).
    usePendleUsdValue: () => hoisted.valueUsd
  };
});

vi.mock('@/modules/ui/context/TransactionContext', () => ({
  useTransaction: () => ({
    launch: hoisted.launchMock,
    updateModalContent: () => undefined,
    isModalOpen: false,
    txCallbacks: {
      onMutate: () => undefined,
      onStart: () => undefined,
      onSuccess: () => undefined,
      onError: () => undefined
    },
    txStatus: 'idle'
  })
}));

vi.mock('../../components/PendleRedeem', () => ({
  PendleRedeem: () => null
}));

import { usePendleRedeemModal } from '../usePendleRedeemModal';

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

const TestConsumer = ({ openOnMount = true }: { openOnMount?: boolean }) => {
  const { openRedeemModal } = usePendleRedeemModal(MATURED_MARKET);
  useEffect(() => {
    if (openOnMount) openRedeemModal();
  }, [openRedeemModal, openOnMount]);
  return null;
};

describe('usePendleRedeemModal analytics', () => {
  beforeEach(() => {
    hoisted.launchMock.mockClear();
    hoisted.matured = true;
    hoisted.valueUsd = (_symbol: string, amount: number) => amount;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('preserves widgetName=fixed, flow=redeem, action=redeem on launch()', () => {
    const { unmount } = renderComponent(<TestConsumer />);
    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('fixed');
    expect(config.analytics.flow).toBe('redeem');
    expect(config.analytics.action).toBe('redeem');
    unmount();
  });

  it('emits analytics.data shaped identically to pendleAnalyticsData(redeem)', () => {
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];

    // Reconstruct the expected blob from the same inputs the hook used.
    const ptToken = {
      name: 'PT-USDG',
      symbol: 'PT-USDG',
      decimals: 6,
      color: '#1BE3C2',
      address: { [mainnet.id]: MATURED_MARKET.ptToken }
    };
    const underlyingToken = {
      name: 'USDG',
      symbol: 'USDG',
      decimals: 6,
      color: '#00C2A1',
      address: { [mainnet.id]: MATURED_MARKET.underlyingToken }
    };
    const expected = pendleAnalyticsData({
      market: MATURED_MARKET,
      side: 'redeem',
      originToken: ptToken,
      targetToken: underlyingToken,
      amountFromBigint: PT_BALANCE,
      amountToBigint: QUOTE.amountOut,
      fromDecimals: MATURED_MARKET.underlyingDecimals,
      toDecimals: MATURED_MARKET.underlyingDecimals,
      slippage: 0.01,
      quote: QUOTE,
      isBatchTx: true
    });

    // Each key in `expected` must be present on the launched blob with the
    // same value. `amount` is added on top of that — assert separately below.
    for (const [key, value] of Object.entries(expected)) {
      expect(config.analytics.data[key]).toEqual(value);
    }
    unmount();
  });

  it('emits a strictly negative amount = USD value of the redeemed output leg', () => {
    // `amount` now values the non-PT output leg (USDS/USDC/underlying the user
    // receives), not the PT count. Output = QUOTE.amountOut (1_499_500n at 6dp)
    // = 1.4995; valued ~$1/token by the stubbed value fn; emitted negative as a
    // withdrawal. (Previously this asserted the PT-balance magnitude of 1.5.)
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.analytics.data.amount).toBeLessThan(0);
    expect(Math.abs(config.analytics.data.amount)).toBeCloseTo(1.4995, 6);
    unmount();
  });

  it('omits amount when the output leg cannot be valued (valueUsd → undefined)', () => {
    hoisted.valueUsd = () => undefined;
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.analytics.widgetName).toBe('fixed');
    expect('amount' in config.analytics.data).toBe(false);
    unmount();
  });

  it('includes module=pendle and the consolidated Pendle fields', () => {
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];
    const data = config.analytics.data;
    expect(data.module).toBe('pendle');
    expect(data.productAddress).toBe(MATURED_MARKET.marketAddress);
    expect(data.ptAddress).toBe(MATURED_MARKET.ptToken);
    expect(data.expiry).toBe(MATURED_MARKET.expiry);
    expect(data.aggregatorType).toBe('KYBERSWAP');
    expect(data.feeUsd).toBe(1.23);
    unmount();
  });
});

describe('usePendleRedeemModal onConfirm freshness', () => {
  beforeEach(() => {
    hoisted.launchMock.mockClear();
    // currentExecute is reassigned per test below, so no clear needed here.
    hoisted.matured = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('onConfirm invokes the latest writeHook.execute, not the one captured at launch', () => {
    // Modal opens with the user's initial selection (e.g. underlying as output).
    // writeHook.execute closes over that render's args.
    const executeAtLaunch = vi.fn();
    hoisted.currentExecute = executeAtLaunch;

    const { rerender, unmount } = renderComponent(<TestConsumer />);

    expect(hoisted.launchMock).toHaveBeenCalledTimes(1);
    const storedOnConfirm = hoisted.launchMock.mock.calls[0][0].onConfirm;

    // User changes something after launch (output token, slippage, or a
    // background quote refetch lands). The next render of useBatchPendleConvert
    // produces a new execute closure referencing the new args. Force the
    // re-render and swap the hoisted execute to model it.
    const executeAfterChange = vi.fn();
    hoisted.currentExecute = executeAfterChange;
    rerender(<TestConsumer openOnMount={false} />);

    // User clicks Confirm. The stored onConfirm — captured at launch — must
    // route through the ref and call the latest execute, not the stale one.
    act(() => {
      storedOnConfirm();
    });

    expect(executeAtLaunch).not.toHaveBeenCalled();
    expect(executeAfterChange).toHaveBeenCalledTimes(1);
    unmount();
  });
});
