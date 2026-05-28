/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ModuleEnum, TransactionTypeEnum } from '../constants';
import { PendleHistoryAction } from './constants';
import type { PendleCombinedHistoryRow, PendleMarketConfig } from './pendle';

vi.mock('./useAllPendleMarketsHistory', () => ({
  useAllPendleMarketsHistory: vi.fn()
}));

import { useAllPendleMarketsHistory } from './useAllPendleMarketsHistory';
import { usePendleCombinedHistory } from './usePendleCombinedHistory';

const PT_USDE: PendleMarketConfig = {
  name: 'PT-USDe',
  marketAddress: '0xa3336f04f7afbf26714331e395054f33b77c9b8d',
  ptToken: '0xAeBf0Bb9f57E89260d57f31AF34eB58657d96Ce0',
  ytToken: '0x4265ebF36F738D4D623C201BecBbc0f92bE57198',
  syToken: '0xf0bAcD9C3D94fC924DBcaaF644208C4E3f4d3bB4',
  underlyingToken: '0x4c9edd5852cd905f086c759e8383e09bff1e68b3',
  underlyingSymbol: 'USDe',
  underlyingDecimals: 18,
  expiry: 1778112000,
  usdsEquivalence: 'pegged'
};

const PT_USDG: PendleMarketConfig = {
  name: 'PT-USDG',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548',
  ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1',
  syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927',
  underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 1779926400,
  usdsEquivalence: 'pegged'
};

function row(
  market: PendleMarketConfig,
  action: PendleHistoryAction,
  timestamp: string,
  amount: number,
  txHash: `0x${string}` = '0xabc'
): PendleCombinedHistoryRow {
  return {
    id: `${txHash}:${action}`,
    txHash,
    timestamp,
    action,
    ptAmount: amount,
    valueUsd: action === PendleHistoryAction.REDEEM_PY ? 0 : amount,
    market
  };
}

describe('usePendleCombinedHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps the three Pendle actions to the right TransactionTypeEnum values', () => {
    vi.mocked(useAllPendleMarketsHistory).mockReturnValue({
      data: [
        row(PT_USDE, PendleHistoryAction.BUY_PT, '2026-02-03T08:10:59Z', 1000, '0x1'),
        row(PT_USDE, PendleHistoryAction.SELL_PT, '2026-03-01T00:00:00Z', 250, '0x2'),
        row(PT_USDE, PendleHistoryAction.REDEEM_PY, '2026-04-22T19:11:11Z', 6143.99, '0x3')
      ],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    const { result } = renderHook(() => usePendleCombinedHistory());
    expect(result.current.data).toBeDefined();
    expect(result.current.data!.map(r => r.type)).toEqual([
      TransactionTypeEnum.PENDLE_BUY,
      TransactionTypeEnum.PENDLE_SELL,
      TransactionTypeEnum.PENDLE_REDEEM
    ]);
    expect(result.current.data!.every(r => r.module === ModuleEnum.PENDLE)).toBe(true);
    expect(result.current.data!.every(r => r.chainId === 1)).toBe(true);
  });

  it('truncates excess fractional digits on the long-product path', () => {
    // PT-USDG has 6-decimal underlying. txValueAsset * effectivePtExchangeRate
    // can produce more than 6 fractional digits (e.g. 100.5 * 0.987654321 =
    // 99.2592292605). The pre-fix code crashed parseUnits on this row.
    vi.mocked(useAllPendleMarketsHistory).mockReturnValue({
      data: [row(PT_USDG, PendleHistoryAction.BUY_PT, '2026-04-01T00:00:00Z', 99.2592292605, '0x1')],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    const { result } = renderHook(() => usePendleCombinedHistory());
    // Truncated to 6 fractional digits: "99.259229" → 99_259_229n.
    expect(result.current.data![0].assets).toBe(99_259_229n);
  });

  it('falls back to toFixed for scientific-notation values', () => {
    // 1e-7 parses to 0.0000001 — toFixed(18) gives "0.000000100000000000".
    vi.mocked(useAllPendleMarketsHistory).mockReturnValue({
      data: [row(PT_USDE, PendleHistoryAction.BUY_PT, '2026-04-01T00:00:00Z', 1e-7, '0x1')],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    const { result } = renderHook(() => usePendleCombinedHistory());
    expect(result.current.data![0].assets).toBe(100_000_000_000n); // 1e-7 * 1e18
  });

  it('converts ptAmount float to assets bigint using the source market decimals', () => {
    // PT-USDe has 18-decimal underlying. 6143.99 → 6143_990000000000000000n.
    // PT-USDG has 6-decimal underlying. 100.5 → 100_500_000n.
    // The 18-decimal path is the regression bookmark: the prior implementation
    // multiplied through Number (6143.99 * 1e18 → ~6.14399e21, well past
    // Number.MAX_SAFE_INTEGER) and yielded a bigint with corrupted low digits.
    vi.mocked(useAllPendleMarketsHistory).mockReturnValue({
      data: [
        row(PT_USDE, PendleHistoryAction.REDEEM_PY, '2026-04-22T19:11:11Z', 6143.99, '0x1'),
        row(PT_USDG, PendleHistoryAction.BUY_PT, '2026-04-01T00:00:00Z', 100.5, '0x2')
      ],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    const { result } = renderHook(() => usePendleCombinedHistory());
    const usde = result.current.data![0];
    const usdg = result.current.data![1];
    expect(usde.underlyingDecimals).toBe(18);
    expect(usde.assets).toBe(6_143_990_000_000_000_000_000n);
    expect(usde.marketName).toBe('PT-USDe');
    expect(usdg.underlyingDecimals).toBe(6);
    expect(usdg.assets).toBe(100_500_000n);
    expect(usdg.marketName).toBe('PT-USDG');
    // Display unit is the PT-Market name — unambiguous about what asset is
    // being transacted (PT) regardless of what wallet token funded it.
    expect(usde.underlyingSymbol).toBe('PT-USDe');
    expect(usdg.underlyingSymbol).toBe('PT-USDG');
  });
});
