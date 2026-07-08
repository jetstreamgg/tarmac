/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { base } from 'viem/chains';

const captured: { swapExactIn: Record<string, unknown> | undefined } = { swapExactIn: undefined };

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useBatchPsmSwapExactIn: (params: Record<string, unknown>) => {
      captured.swapExactIn = params;
      return {
        prepared: false,
        isLoading: false,
        error: null,
        execute: () => {},
        currentCallIndex: 0,
        reset: () => {}
      };
    },
    useBatchUsdsPsmWrapperSellGem: () => ({
      prepared: false,
      isLoading: false,
      error: null,
      execute: () => {},
      currentCallIndex: 0,
      reset: () => {}
    }),
    useBatchUsdsPsmWrapperBuyGem: () => ({
      prepared: false,
      isLoading: false,
      error: null,
      execute: () => {},
      currentCallIndex: 0,
      reset: () => {}
    }),
    useTokenAllowance: () => ({ data: 0n, mutate: () => {} }),
    useIsBatchSupported: () => ({ data: false }),
    useUsdsPsmWrapperLive: () => ({ data: 1n, refetch: () => {} }),
    useUsdsPsmWrapperTin: () => ({ data: 0n, refetch: () => {} }),
    useUsdsPsmWrapperTout: () => ({ data: 0n, refetch: () => {} }),
    useUsdsPsmWrapperHalted: () => ({ data: 0n, refetch: () => {} }),
    usePsmPocketBalance: () => ({ data: undefined, refetch: () => {} }),
    usePsmLiquidity: () => ({ data: undefined, mutate: () => {} })
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return {
    ...actual,
    useChainId: () => base.id,
    useConnection: () => ({ address: '0x000000000000000000000000000000000000beef' })
  };
});

import { usePsmConversion } from './usePsmConversion';

describe('usePsmConversion referralCode contract-arg', () => {
  beforeEach(() => {
    captured.swapExactIn = undefined;
  });

  it('passes referralCode under `referralCode:` as BigInt (L2 swap exact-in)', () => {
    renderHook(() =>
      usePsmConversion({
        direction: 'USDC_TO_USDS',
        amount: 1_000_000n,
        referralCode: 12345
      })
    );
    expect(captured.swapExactIn?.referralCode).toBe(12345n);
    expect(typeof captured.swapExactIn?.referralCode).toBe('bigint');
  });

  it('forwards undefined when referralCode is undefined (truthy gate)', () => {
    renderHook(() =>
      usePsmConversion({
        direction: 'USDC_TO_USDS',
        amount: 1_000_000n,
        referralCode: undefined
      })
    );
    expect(captured.swapExactIn?.referralCode).toBeUndefined();
  });
});
