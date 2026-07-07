import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';

const h = vi.hoisted(() => ({
  chainId: 1 as number,
  isConnected: true,
  usdsBalance: 0n as bigint,
  usdcBalance: 0n as bigint,
  searchInit: '' as string,
  setSearchParams: vi.fn()
}));

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => h.chainId,
    useConnection: () => ({
      address: h.isConnected ? '0xc12f7C1F2DCE119e2d0b77D65eC479Bfc32b0327' : undefined,
      isConnected: h.isConnected
    })
  };
});

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useTokenBalance: ({ token }: { token?: string }) => {
      const usds = actual.TOKENS.usds.address[h.chainId]?.toLowerCase();
      const value = token?.toLowerCase() === usds ? h.usdsBalance : h.usdcBalance;
      return { data: { value }, refetch: vi.fn() };
    }
  };
});

vi.mock('@/lib/navigation', () => ({
  useAppSearchParams: () => [new URLSearchParams(h.searchInit), h.setSearchParams]
}));

import { useConvertForm } from './useConvertForm';

beforeEach(() => {
  vi.clearAllMocks();
  h.chainId = 1;
  h.isConnected = true;
  h.usdsBalance = 0n;
  h.usdcBalance = 0n;
  h.searchInit = '';
});

afterEach(cleanup);

describe('useConvertForm', () => {
  it('defaults to USDS → USDC (the Figma default frame)', () => {
    const { result } = renderHook(() => useConvertForm());
    expect(result.current.direction).toBe('USDS_TO_USDC');
    expect(result.current.originSymbol).toBe('USDS');
    expect(result.current.targetSymbol).toBe('USDC');
    expect(result.current.originDecimals).toBe(18);
    expect(result.current.targetDecimals).toBe(6);
  });

  it('honours the legacy ?source_token=USDC deep link', () => {
    h.searchInit = 'source_token=USDC';
    const { result } = renderHook(() => useConvertForm());
    expect(result.current.direction).toBe('USDC_TO_USDS');
    expect(result.current.originSymbol).toBe('USDC');
    expect(result.current.originDecimals).toBe(6);
  });

  it('parses the typed amount at origin decimals and derives the target 1:1', () => {
    const { result } = renderHook(() => useConvertForm());
    act(() => result.current.onInput('1.5'));
    expect(result.current.value).toBe('1.5');
    expect(result.current.amount).toBe(parseUnits('1.5', 18));
    expect(result.current.targetAmount).toBe(parseUnits('1.5', 6));
    expect(result.current.targetValue).toBe('1.5');
  });

  it('rejects non-decimal input and fractions beyond the origin decimals', () => {
    h.searchInit = 'source_token=USDC'; // USDC origin: 6 decimals
    const { result } = renderHook(() => useConvertForm());

    act(() => result.current.onInput('abc'));
    expect(result.current.value).toBe('');

    act(() => result.current.onInput('1.1234567'));
    expect(result.current.value).toBe('');

    act(() => result.current.onInput('1.123456'));
    expect(result.current.value).toBe('1.123456');
  });

  it('flip inverts the direction, clamps the fraction and writes ?source_token=', () => {
    const { result } = renderHook(() => useConvertForm());
    act(() => result.current.onInput('1.1234567890123'));
    act(() => result.current.flip());

    expect(result.current.direction).toBe('USDC_TO_USDS');
    // 18-dec USDS fraction clamped to USDC's 6 decimals.
    expect(result.current.value).toBe('1.123456');
    expect(h.setSearchParams).toHaveBeenCalled();
    const updater = h.setSearchParams.mock.calls.at(-1)![0];
    expect(updater(new URLSearchParams()).get('source_token')).toBe('USDC');
  });

  it('token chips flip direction from either side and never duplicate a token', () => {
    const { result } = renderHook(() => useConvertForm());

    // Picking USDC on the From side: USDC becomes the origin.
    act(() => result.current.selectToken('from', 'USDC'));
    expect(result.current.direction).toBe('USDC_TO_USDS');

    // Picking USDC on the To side: USDC becomes the target again.
    act(() => result.current.selectToken('to', 'USDC'));
    expect(result.current.direction).toBe('USDS_TO_USDC');
  });

  it('percentage pills derive the value from the origin balance with bigint math', () => {
    h.usdsBalance = parseUnits('1000', 18);
    const { result } = renderHook(() => useConvertForm());

    act(() => result.current.setPercent(25));
    expect(result.current.value).toBe('250');
    expect(result.current.amount).toBe(parseUnits('250', 18));

    act(() => result.current.setPercent(100));
    expect(result.current.amount).toBe(h.usdsBalance);
  });

  it('flags an amount above the origin balance as insufficient', () => {
    h.usdsBalance = parseUnits('10', 18);
    const { result } = renderHook(() => useConvertForm());

    act(() => result.current.onInput('11'));
    expect(result.current.insufficient).toBe(true);

    act(() => result.current.onInput('10'));
    expect(result.current.insufficient).toBe(false);
  });

  it('reset clears the typed amount', () => {
    const { result } = renderHook(() => useConvertForm());
    act(() => result.current.onInput('5'));
    act(() => result.current.reset());
    expect(result.current.value).toBe('');
    expect(result.current.isZero).toBe(true);
  });
});
