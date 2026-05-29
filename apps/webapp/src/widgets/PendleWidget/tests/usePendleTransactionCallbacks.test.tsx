/// <reference types="vite/client" />

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { i18n } from '@lingui/core';
import { mainnet } from 'viem/chains';

vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/hooks')>('@/hooks');
  return { ...actual, useAllPendleMarketsHistory: () => ({ mutate: vi.fn() }) };
});

import { PendleConvertSide } from '@/hooks';
import type { PendleConvertQuote, PendleMarketConfig, Token } from '@/hooks';
import { WidgetAnalyticsEventType } from '@/widgets/shared/types/analyticsEvents';
import { PendleFlow } from '../lib/constants';
import { pendleAnalyticsData } from '../lib/pendleAnalyticsData';
import { usePendleTransactionCallbacks } from '../hooks/usePendleTransactionCallbacks';

i18n.load('en', {});
i18n.activate('en');

const MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38d74a0d29380899ad354121dfb521adb0548',
  ytToken: '0x4a1294749a70bc32a998b49dd11bf26e9379e3c1',
  syToken: '0xc1799cab1f201946f7cfafbaf1bcc089b2f08927',
  underlyingToken: '0xe343167631d89b6ffc58b88d6b7fb0228795491d',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: Math.floor(Date.now() / 1000) + 30 * 86_400
};

const USDG_TOKEN: Token = {
  name: 'USDG',
  symbol: 'USDG',
  decimals: 6,
  color: '#00C2A1',
  address: { [mainnet.id]: MARKET.underlyingToken }
};

const PT_TOKEN: Token = {
  name: 'PT-USDG',
  symbol: 'PT-USDG',
  decimals: 6,
  color: '#1BE3C2',
  address: { [mainnet.id]: MARKET.ptToken }
};

const QUOTE: PendleConvertQuote = {
  method: 'addLiquidityDualSyAndPt',
  amountOut: 1_500_000n,
  apiMinOut: 1_485_000n,
  effectiveApy: 0.054,
  impliedApy: 0.06,
  priceImpact: -0.0012,
  aggregatorType: 'KYBERSWAP',
  feeUsd: 1.23,
  fetchedAt: Date.now(),
  apiContractParams: [],
  apiContractParamsName: []
};

type BuildParams = Parameters<typeof usePendleTransactionCallbacks>[0];

const baseParams = (overrides: Partial<BuildParams>): BuildParams => ({
  flow: PendleFlow.BUY,
  side: PendleConvertSide.BUY,
  market: MARKET,
  originToken: USDG_TOKEN,
  targetToken: PT_TOKEN,
  amount: 1_000_000n, // 1 USDG (6 decimals)
  fromDecimals: 6,
  toDecimals: 6,
  slippage: 0.002,
  quote: QUOTE,
  needsAllowance: true,
  shouldUseBatch: false,
  chainId: mainnet.id,
  address: '0x000000000000000000000000000000000000beef',
  isSafeWallet: false,
  setTxStatus: vi.fn(),
  setExternalLink: vi.fn(),
  setWidgetState: vi.fn(),
  refetchInputBalance: vi.fn(),
  refetchOutputBalance: vi.fn(),
  refetchPtBalance: vi.fn(),
  onNotification: vi.fn(),
  onAnalyticsEvent: vi.fn(),
  // `amount` is now the USD value of the non-PT leg; the hook delegates the
  // valuation to this injected fn. The default treats every token as ~$1 so
  // the existing action/shape assertions are unaffected; the USD-specific
  // behaviour is covered in its own test below and in pendleUsdValue.test.ts.
  valueUsd: (_symbol: string, amount: number) => amount,
  ...overrides
});

describe('usePendleTransactionCallbacks', () => {
  describe('BUY non-batch with allowance needed', () => {
    it('fires TRANSACTION_STARTED with action="approve" then action="supply" across two onMutate calls', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({ onAnalyticsEvent });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      act(() => {
        result.current.onMutate();
      });
      act(() => {
        result.current.onMutate();
      });

      expect(onAnalyticsEvent).toHaveBeenCalledTimes(2);

      const first = onAnalyticsEvent.mock.calls[0][0];
      expect(first.event).toBe(WidgetAnalyticsEventType.TRANSACTION_STARTED);
      expect(first.action).toBe('approve');
      expect(first.flow).toBe('supply');

      const second = onAnalyticsEvent.mock.calls[1][0];
      expect(second.event).toBe(WidgetAnalyticsEventType.TRANSACTION_STARTED);
      expect(second.action).toBe('supply');
      expect(second.flow).toBe('supply');
    });

    it('emits a data blob matching pendleAnalyticsData() called with the same inputs', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({ onAnalyticsEvent });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      act(() => {
        result.current.onMutate();
      });

      const expectedData = pendleAnalyticsData({
        market: MARKET,
        side: 'buy',
        originToken: USDG_TOKEN,
        targetToken: PT_TOKEN,
        amountFromBigint: 1_000_000n,
        amountToBigint: QUOTE.amountOut,
        fromDecimals: 6,
        toDecimals: 6,
        slippage: 0.002,
        quote: QUOTE,
        isBatchTx: false
      });

      expect(onAnalyticsEvent.mock.calls[0][0].data).toEqual(expectedData);
    });
  });

  describe('BUY batch mode', () => {
    it('fires TRANSACTION_STARTED once with action="supply"', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({
        onAnalyticsEvent,
        shouldUseBatch: true
      });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      act(() => {
        result.current.onMutate();
      });

      expect(onAnalyticsEvent).toHaveBeenCalledTimes(1);
      const evt = onAnalyticsEvent.mock.calls[0][0];
      expect(evt.event).toBe(WidgetAnalyticsEventType.TRANSACTION_STARTED);
      expect(evt.action).toBe('supply');
      expect(evt.flow).toBe('supply');
      expect(evt.data.isBatchTx).toBe(true);
    });
  });

  describe('SELL non-batch with allowance needed', () => {
    it('fires TRANSACTION_STARTED with action="approve" then action="withdraw"', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({
        onAnalyticsEvent,
        flow: PendleFlow.WITHDRAW,
        side: PendleConvertSide.WITHDRAW,
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN
      });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      act(() => {
        result.current.onMutate();
      });
      act(() => {
        result.current.onMutate();
      });

      expect(onAnalyticsEvent).toHaveBeenCalledTimes(2);
      expect(onAnalyticsEvent.mock.calls[0][0].action).toBe('approve');
      expect(onAnalyticsEvent.mock.calls[0][0].flow).toBe('withdraw');
      expect(onAnalyticsEvent.mock.calls[1][0].action).toBe('withdraw');
      expect(onAnalyticsEvent.mock.calls[1][0].flow).toBe('withdraw');
    });
  });

  describe('SELL batch mode', () => {
    it('fires TRANSACTION_STARTED once with action="withdraw"', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({
        onAnalyticsEvent,
        flow: PendleFlow.WITHDRAW,
        side: PendleConvertSide.WITHDRAW,
        originToken: PT_TOKEN,
        targetToken: USDG_TOKEN,
        shouldUseBatch: true
      });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      act(() => {
        result.current.onMutate();
      });

      expect(onAnalyticsEvent).toHaveBeenCalledTimes(1);
      expect(onAnalyticsEvent.mock.calls[0][0].action).toBe('withdraw');
    });
  });

  describe('onSuccess', () => {
    it('fires exactly one TRANSACTION_COMPLETED with main action and txHash propagated', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({ onAnalyticsEvent });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      act(() => {
        result.current.onSuccess('0xabc' as `0x${string}`);
      });

      const completed = onAnalyticsEvent.mock.calls.filter(
        c => c[0].event === WidgetAnalyticsEventType.TRANSACTION_COMPLETED
      );
      expect(completed).toHaveLength(1);
      expect(completed[0][0].action).toBe('supply');
      expect(completed[0][0].flow).toBe('supply');
      expect(completed[0][0].txHash).toBe('0xabc');
    });
  });

  describe('USD amount', () => {
    it('emits amount = USD value of the non-PT leg (valueUsd applied), not the token count', () => {
      const onAnalyticsEvent = vi.fn();
      // BUY of 1 USDG; value it at 1.05 USD/token to prove `amount` tracks the
      // value-fn output, not the 1.0 token count.
      const params = baseParams({
        onAnalyticsEvent,
        valueUsd: (_symbol: string, amount: number) => amount * 1.05
      });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));
      act(() => {
        result.current.onMutate();
      });

      expect(onAnalyticsEvent.mock.calls[0][0].amount).toBeCloseTo(1.05, 6);
    });

    it('omits amount when the leg cannot be valued (valueUsd → undefined)', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({ onAnalyticsEvent, valueUsd: () => undefined });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));
      act(() => {
        result.current.onMutate();
      });

      // Event still fires; amount is simply absent.
      expect(onAnalyticsEvent).toHaveBeenCalledTimes(1);
      expect(onAnalyticsEvent.mock.calls[0][0].amount).toBeUndefined();
    });
  });

  describe('onError at step 0 (approve failure)', () => {
    it('fires TRANSACTION_ERROR with the main action, not "approve"', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({ onAnalyticsEvent });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      // Simulate the approve step failing immediately (no prior onMutate completing the sequence)
      act(() => {
        result.current.onMutate();
      });
      act(() => {
        result.current.onError(new Error('User rejected'), undefined);
      });

      const errors = onAnalyticsEvent.mock.calls.filter(
        c => c[0].event === WidgetAnalyticsEventType.TRANSACTION_ERROR
      );
      expect(errors).toHaveLength(1);
      // Matches Vaults inheritance: TRANSACTION_ERROR always carries main action
      expect(errors[0][0].action).toBe('supply');
      expect(errors[0][0].flow).toBe('supply');
    });
  });

  describe('analytics resilience', () => {
    it('does not throw when onAnalyticsEvent throws', () => {
      const onAnalyticsEvent = vi.fn(() => {
        throw new Error('analytics broke');
      });
      const params = baseParams({ onAnalyticsEvent });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      expect(() => {
        act(() => {
          result.current.onMutate();
        });
      }).not.toThrow();
      expect(() => {
        act(() => {
          result.current.onSuccess('0xabc' as `0x${string}`);
        });
      }).not.toThrow();
      expect(() => {
        act(() => {
          result.current.onError(new Error('boom'), undefined);
        });
      }).not.toThrow();
    });

    it('does not throw when onAnalyticsEvent is undefined', () => {
      const params = baseParams({ onAnalyticsEvent: undefined });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      expect(() => {
        act(() => {
          result.current.onMutate();
          result.current.onStart('0xabc' as `0x${string}`);
          result.current.onSuccess('0xabc' as `0x${string}`);
          result.current.onError(new Error('boom'), '0xabc' as `0x${string}`);
        });
      }).not.toThrow();
    });
  });

  describe('supplyStepRef reset', () => {
    it('resets to 0 after onSuccess so the next sequence starts at approve again', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({ onAnalyticsEvent });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      act(() => {
        result.current.onMutate();
        result.current.onMutate();
        result.current.onSuccess('0xabc' as `0x${string}`);
      });
      onAnalyticsEvent.mockClear();

      act(() => {
        result.current.onMutate();
      });

      // The next onMutate after a completed sequence should again be the approve step.
      expect(onAnalyticsEvent.mock.calls[0][0].action).toBe('approve');
    });

    it('resets to 0 after onError', () => {
      const onAnalyticsEvent = vi.fn();
      const params = baseParams({ onAnalyticsEvent });

      const { result } = renderHook(() => usePendleTransactionCallbacks(params));

      act(() => {
        result.current.onMutate();
        result.current.onError(new Error('boom'), undefined);
      });
      onAnalyticsEvent.mockClear();

      act(() => {
        result.current.onMutate();
      });

      expect(onAnalyticsEvent.mock.calls[0][0].action).toBe('approve');
    });
  });
});
