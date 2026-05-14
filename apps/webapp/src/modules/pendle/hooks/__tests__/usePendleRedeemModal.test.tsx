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
  matured: true
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
    useBatchPendleConvert: () => ({
      execute: () => undefined,
      reset: () => undefined,
      prepared: true,
      isLoading: false,
      error: undefined,
      currentCallIndex: 0
    })
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
    })
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

  it('emits a strictly negative amount in analytics.data with PT-balance magnitude', () => {
    const { unmount } = renderComponent(<TestConsumer />);
    const config = hoisted.launchMock.mock.calls[0][0];
    expect(config.analytics.data.amount).toBeLessThan(0);
    expect(Math.abs(config.analytics.data.amount)).toBeCloseTo(1.5, 6);
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
