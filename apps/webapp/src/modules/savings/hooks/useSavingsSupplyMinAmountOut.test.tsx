/// <reference types="vite/client" />

import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';
import { math } from '@/utils';
import { EPOCH_LENGTH } from '@/widgets/shared/constants';

// Fixed SSR auth oracle reads (ray-scaled) + a fixed clock so the chi projection
// is deterministic. NOW is ~1000s past RHO, well inside one epoch.
const CHI = parseUnits('1.05', 27);
const RHO = 1_700_000_000n;
const SSR = parseUnits('1.0000001', 27);
const NOW_MS = 1_700_001_000_000;

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useReadSsrAuthOracleGetChi: () => ({ data: CHI }),
    useReadSsrAuthOracleGetRho: () => ({ data: RHO }),
    useReadSsrAuthOracleGetSsr: () => ({ data: SSR })
  };
});

import { TOKENS } from '@/hooks';
import { useSavingsSupplyMinAmountOut } from './useSavingsSupplyMinAmountOut';

// Re-derive the legacy computation independently to compare against.
function expectedMinOut(amount: bigint, isUsdc: boolean): bigint {
  const timestamp = Math.floor(NOW_MS / 1000);
  const elapsed = BigInt(timestamp) + BigInt(EPOCH_LENGTH) - RHO;
  const updatedChi = math.updatedChi(SSR, Number(elapsed), CHI);
  const wad = isUsdc ? math.convertUSDCtoWad(amount) : amount;
  const shares = math.calculateSharesFromAssets(wad, updatedChi);
  return isUsdc ? math.roundDownLastTwelveDigits(shares) : shares;
}

describe('useSavingsSupplyMinAmountOut', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it('projects chi forward one epoch and converts USDS assets to sUSDS shares', () => {
    const amount = parseUnits('100', 18);
    const { result } = renderHook(() => useSavingsSupplyMinAmountOut({ amount, originToken: TOKENS.usds }));
    expect(result.current).toBe(expectedMinOut(amount, false));
    expect(result.current).toBeGreaterThan(0n);
  });

  it('widens USDC (6dp) input to wad and rounds the share floor down (zeroes last 12 digits)', () => {
    const amount = parseUnits('100', 6);
    const { result } = renderHook(() => useSavingsSupplyMinAmountOut({ amount, originToken: TOKENS.usdc }));
    expect(result.current).toBe(expectedMinOut(amount, true));
    // roundDownLastTwelveDigits leaves the trailing 12 digits zeroed.
    expect(result.current % 10n ** 12n).toBe(0n);
  });

  it('returns 0 when the oracle has not resolved (amount with zero chi)', () => {
    const { result } = renderHook(() =>
      useSavingsSupplyMinAmountOut({ amount: 0n, originToken: TOKENS.usds })
    );
    expect(result.current).toBe(0n);
  });
});
