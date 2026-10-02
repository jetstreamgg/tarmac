/// <reference types="vite/client" />

import { renderHook, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseUnits } from 'viem';

const RAY = 10n ** 27n;
const h = vi.hoisted(() => ({ chi: undefined as bigint | undefined }));

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return { ...actual, useReadSsrAuthOracleGetChi: () => ({ data: h.chi }) };
});

import { TOKENS } from '@/hooks';
import { useSavingsWithdrawBounds } from './useSavingsWithdrawBounds';

const CHI = parseUnits('1.111347176527', 27);
// The oracle's live conversion rate: chi accrued forward from rho.
const LIVE_RATE = parseUnits('1.111392450181', 27);

const bounds = (amount: bigint, sUsdsBalance: bigint | undefined, token = TOKENS.usds) =>
  renderHook(() => useSavingsWithdrawBounds({ amount, sUsdsBalance, originToken: token })).result.current;

describe('useSavingsWithdrawBounds', () => {
  afterEach(() => {
    h.chi = undefined;
    cleanup();
  });

  it('prices the whole balance at the stored chi, rounding the floor down', () => {
    h.chi = CHI;
    const balance = parseUnits('100000', 18);
    expect(bounds(0n, balance).minAmountOutForWithdrawAll).toBe((balance * CHI) / RAY);
  });

  it('keeps the floor at or under what the live rate pays out', () => {
    h.chi = CHI;
    const balance = parseUnits('100000', 18);
    expect(bounds(0n, balance).minAmountOutForWithdrawAll).toBeLessThanOrEqual((balance * LIVE_RATE) / RAY);
    expect(bounds(0n, balance, TOKENS.usdc).minAmountOutForWithdrawAll).toBeLessThanOrEqual(
      (balance * LIVE_RATE) / RAY / 10n ** 12n
    );
  });

  it('truncates the floor to USDC precision', () => {
    h.chi = CHI;
    const balance = parseUnits('100000', 18);
    expect(bounds(0n, balance, TOKENS.usdc).minAmountOutForWithdrawAll).toBe(
      (balance * CHI) / RAY / 10n ** 12n
    );
  });

  it('rounds the exact-out ceiling up and keeps it at or over what the live rate takes in', () => {
    h.chi = CHI;
    const amount = parseUnits('5000', 18);
    const { maxAmountInForWithdraw } = bounds(amount, undefined);
    expect(maxAmountInForWithdraw * CHI).toBeGreaterThanOrEqual(amount * RAY);
    expect((maxAmountInForWithdraw - 1n) * CHI).toBeLessThan(amount * RAY);
    expect(maxAmountInForWithdraw).toBeGreaterThanOrEqual((amount * RAY + LIVE_RATE - 1n) / LIVE_RATE);
  });

  it('widens a USDC amount to wad before computing the ceiling', () => {
    h.chi = CHI;
    const usdc = bounds(parseUnits('5000', 6), undefined, TOKENS.usdc).maxAmountInForWithdraw;
    const usds = bounds(parseUnits('5000', 18), undefined).maxAmountInForWithdraw;
    expect(usdc).toBe(usds);
  });

  it('only moves when chi does', () => {
    h.chi = CHI;
    const balance = parseUnits('100000', 18);
    const { result, rerender } = renderHook(() =>
      useSavingsWithdrawBounds({
        amount: parseUnits('10', 18),
        sUsdsBalance: balance,
        originToken: TOKENS.usds
      })
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('returns zero bounds until chi loads', () => {
    expect(bounds(parseUnits('10', 18), parseUnits('100', 18))).toEqual({
      minAmountOutForWithdrawAll: 0n,
      maxAmountInForWithdraw: 0n
    });
  });
});
