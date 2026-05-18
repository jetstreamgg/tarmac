/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PendleHistoryAction } from './constants';
import type { PendleHistoryRow, PendleMarketConfig } from './pendle';

// Mock the upstream hooks and wagmi so this test exercises ONLY the wiring
// from inputs → computeMaturedEarnings → outputs. The math branches are
// covered exhaustively in computeMaturedEarnings.test.ts; here we just need
// to confirm that no value gets misrouted between the layers.
vi.mock('./usePendleMarketHistory', () => ({
  usePendleMarketHistory: vi.fn()
}));

vi.mock('./usePendleRedeemPreview', () => ({
  usePendleRedeemPreview: vi.fn()
}));

vi.mock('wagmi', () => ({
  useChainId: vi.fn(() => 1),
  useReadContract: vi.fn()
}));

vi.mock('@/utils', () => ({
  isTestnetId: vi.fn(() => false)
}));

import { usePendleMarketHistory } from './usePendleMarketHistory';
import { usePendleRedeemPreview } from './usePendleRedeemPreview';
import { useReadContract } from 'wagmi';
import { usePendleMaturedPositionEarnings } from './usePendleMaturedPositionEarnings';

const PEGGED_MARKET: PendleMarketConfig = {
  name: 'PT-USDG',
  marketAddress: '0xc5b32dba5f29f8395fb9591e1a15f23a75214f33',
  ptToken: '0x9db38D74a0D29380899aD354121DfB521aDb0548',
  ytToken: '0x4a1294749A70bc32A998B49dd11Bf26E9379e3C1',
  syToken: '0xc1799CaB1F201946f7CFaFBaF1BCC089b2F08927',
  underlyingToken: '0xe343167631d89B6Ffc58B88d6b7fB0228795491D',
  underlyingSymbol: 'USDG',
  underlyingDecimals: 6,
  expiry: 2_000_000_000,
  usdsEquivalence: 'pegged'
};

// Mirrors the "pegged path: single buy, no sell" fixture in
// computeMaturedEarnings.test.ts so the wiring assertion lines up 1:1 with a
// known pure-function result.
const NINETY_DAYS_BEFORE_EXPIRY = (PEGGED_MARKET.expiry - 90 * 86_400) * 1000;
const BUY_TRADE: PendleHistoryRow = {
  id: 'tx-1',
  txHash: '0xabc',
  timestamp: new Date(NINETY_DAYS_BEFORE_EXPIRY).toISOString(),
  action: PendleHistoryAction.BUY_PT,
  ptAmount: 1000,
  valueUsd: 1000
};

// 1010 USDG with 6 decimals
const PREVIEW_AMOUNT = 1_010_000_000n;
// 1000 PT-USDG. Decimals match the underlying (USDG = 6) per Pendle
// convention; the pre-PR-#1546-review fixture hardcoded 18 here, which
// only "worked" because the hook also divided by 1e18 universally.
const PT_BALANCE = 1000n * 10n ** BigInt(PEGGED_MARKET.underlyingDecimals);

describe('usePendleMaturedPositionEarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(usePendleMarketHistory).mockReturnValue({
      data: [BUY_TRADE],
      isLoading: false,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    vi.mocked(usePendleRedeemPreview).mockReturnValue({
      data: PREVIEW_AMOUNT,
      isLoading: false,
      error: undefined
    });

    // chi is only consulted on the sUSDS path; on pegged it's read but
    // ignored. Return undefined to make sure the pegged-path doesn't lean on
    // it accidentally.
    vi.mocked(useReadContract).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn()
      // wagmi's useReadContract return type has many fields we don't need
      // here; cast at the mock boundary.
    } as unknown as ReturnType<typeof useReadContract>);
  });

  it('wires upstream hook values into computeMaturedEarnings and surfaces the result', () => {
    const { result } = renderHook(() => usePendleMaturedPositionEarnings(PEGGED_MARKET, PT_BALANCE));

    // Same inputs the pure-function test "pegged path: single buy, no sell"
    // uses — earnings ≈ 10, APY > 0, currency = 'USDS'.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.currency).toBe('USDS');
    expect(result.current.earnings).toBeCloseTo(10, 4);
    expect(result.current.apy).toBeGreaterThan(0);
  });

  it('surfaces isLoading and undefined values when market history is loading', () => {
    vi.mocked(usePendleMarketHistory).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      mutate: vi.fn(),
      dataSources: []
    });

    const { result } = renderHook(() => usePendleMaturedPositionEarnings(PEGGED_MARKET, PT_BALANCE));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.earnings).toBeUndefined();
    expect(result.current.apy).toBeUndefined();
    expect(result.current.currency).toBeUndefined();
  });

  it('surfaces isLoading and undefined values when the redeem preview is loading', () => {
    vi.mocked(usePendleRedeemPreview).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined
    });

    const { result } = renderHook(() => usePendleMaturedPositionEarnings(PEGGED_MARKET, PT_BALANCE));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.earnings).toBeUndefined();
    expect(result.current.apy).toBeUndefined();
    expect(result.current.currency).toBeUndefined();
  });
});
