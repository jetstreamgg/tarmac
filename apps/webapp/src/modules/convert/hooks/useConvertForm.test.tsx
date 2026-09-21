import { renderHook, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';

const h = vi.hoisted(() => {
  const state = {
    chainId: 1 as number,
    isConnected: true,
    usdsBalance: 0n as bigint,
    usdcBalance: 0n as bigint,
    searchInit: '' as string,
    setSearchParams: undefined as unknown as ReturnType<typeof vi.fn>
  };
  state.setSearchParams = vi.fn((init: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams)) => {
    const next = typeof init === 'function' ? init(new URLSearchParams(state.searchInit)) : init;
    state.searchInit = next.toString();
  });
  return state;
});

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

// The setter applies the update to the shared search string (mirroring the real
// router) — the hook derives `direction` from the params, so flips only work if
// URL writes actually land.
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
  it('defaults to USDC → USDS (APP-560)', () => {
    const { result } = renderHook(() => useConvertForm());
    expect(result.current.direction).toBe('USDC_TO_USDS');
    expect(result.current.originSymbol).toBe('USDC');
    expect(result.current.targetSymbol).toBe('USDS');
    expect(result.current.originDecimals).toBe(6);
    expect(result.current.targetDecimals).toBe(18);
  });

  it('honours the legacy ?source_token=USDS deep link', () => {
    h.searchInit = 'source_token=USDS';
    const { result } = renderHook(() => useConvertForm());
    expect(result.current.direction).toBe('USDS_TO_USDC');
    expect(result.current.originSymbol).toBe('USDS');
    expect(result.current.originDecimals).toBe(18);
  });

  it('parses the typed amount at origin decimals and derives the target 1:1', () => {
    const { result } = renderHook(() => useConvertForm());
    act(() => result.current.onInput('1.5'));
    expect(result.current.value).toBe('1.5');
    expect(result.current.amount).toBe(parseUnits('1.5', 6));
    expect(result.current.targetAmount).toBe(parseUnits('1.5', 18));
    expect(result.current.targetValue).toBe('1.5');
  });

  it('groups the derived To figure for display while keeping the raw amount exact (APP-553)', () => {
    const { result } = renderHook(() => useConvertForm());
    act(() => result.current.onInput('189924037.3125'));
    expect(result.current.targetAmount).toBe(parseUnits('189924037.3125', 18));
    expect(result.current.targetValue).toBe('189,924,037.3125');
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

  it('holds the in-progress decimal point the iOS keypad types (APP-518)', () => {
    const { result } = renderHook(() => useConvertForm());

    // A leading separator: dropping it would land the next digit as a whole unit.
    act(() => result.current.onInput(','));
    expect(result.current.value).toBe('.');
    expect(result.current.amount).toBe(0n);

    act(() => result.current.onInput('.5'));
    expect(result.current.value).toBe('.5');
    expect(result.current.amount).toBe(parseUnits('0.5', 6));

    // A second tap of the key must not relocate the point (0.5 → 5).
    act(() => result.current.onInput('.5,'));
    expect(result.current.value).toBe('.5');
  });

  it('flip inverts the direction via the URL, clamping the typed fraction', () => {
    h.searchInit = 'source_token=USDS'; // USDS origin: 18 decimals, clamped to 6 on flip
    // The router re-renders on URL writes in the app; `rerender()` stands in here.
    const { result, rerender } = renderHook(() => useConvertForm());
    act(() => result.current.onInput('1.1234567890123'));
    act(() => result.current.flip());
    rerender();

    expect(h.searchInit).toContain('source_token=USDC');
    expect(result.current.direction).toBe('USDC_TO_USDS');
    // 18-dec USDS fraction clamped to USDC's 6 decimals at read time.
    expect(result.current.value).toBe('1.123456');
  });

  it('flip keeps the scroll position when writing the URL', () => {
    // The page overflows short viewports (Safe iframe, small laptops); the
    // router's default scroll-to-top on navigation made the flip read as broken.
    const { result } = renderHook(() => useConvertForm());
    act(() => result.current.flip());

    expect(h.setSearchParams).toHaveBeenCalledWith(expect.any(Function), {
      replace: true,
      resetScroll: false
    });
  });

  it('follows external ?source_token= changes (browser back/forward)', () => {
    const { result, rerender } = renderHook(() => useConvertForm());
    expect(result.current.direction).toBe('USDC_TO_USDS');

    // Back/forward and direct navigation change the param without touching the
    // form — the derived direction must follow.
    h.searchInit = 'source_token=USDS';
    rerender();
    expect(result.current.direction).toBe('USDS_TO_USDC');

    h.searchInit = 'source_token=USDC';
    rerender();
    expect(result.current.direction).toBe('USDC_TO_USDS');
  });

  it('token chips flip direction from either side and never duplicate a token', () => {
    const { result, rerender } = renderHook(() => useConvertForm());

    // Picking USDS on the From side: USDS becomes the origin.
    act(() => result.current.selectToken('from', 'USDS'));
    rerender();
    expect(result.current.direction).toBe('USDS_TO_USDC');

    // Picking USDS on the To side: USDS becomes the target again.
    act(() => result.current.selectToken('to', 'USDS'));
    rerender();
    expect(result.current.direction).toBe('USDC_TO_USDS');
  });

  it('percentage pills derive the value from the origin balance with bigint math', () => {
    h.usdcBalance = parseUnits('1000', 6);
    const { result } = renderHook(() => useConvertForm());

    act(() => result.current.setPercent(25));
    expect(result.current.value).toBe('250');
    expect(result.current.amount).toBe(parseUnits('250', 6));

    act(() => result.current.setPercent(100));
    expect(result.current.amount).toBe(h.usdcBalance);
  });

  it('flags an amount above the origin balance as insufficient', () => {
    h.usdcBalance = parseUnits('10', 6);
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
