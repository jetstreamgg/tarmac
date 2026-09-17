/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { base } from 'viem/chains';

const captured: { swapExactIn: readonly unknown[] | undefined } = { swapExactIn: undefined };

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useApproveThenAct: ({
      legs
    }: {
      legs: { calls: { functionName?: string; args?: readonly unknown[] }[] }[];
    }) => {
      const swap = legs[0]?.calls.find(call => call.functionName === 'swapExactIn');
      captured.swapExactIn = swap?.args;
      return {
        prepared: false,
        isLoading: false,
        error: null,
        execute: () => {},
        currentCallIndex: 0,
        reset: () => {},
        plan: []
      };
    },
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
    // swapExactIn(assetIn, assetOut, amountIn, minAmountOut, receiver, referralCode)
    expect(captured.swapExactIn?.[5]).toBe(12345n);
    expect(typeof captured.swapExactIn?.[5]).toBe('bigint');
  });

  it('forwards undefined when referralCode is undefined (truthy gate)', () => {
    renderHook(() =>
      usePsmConversion({
        direction: 'USDC_TO_USDS',
        amount: 1_000_000n,
        referralCode: undefined
      })
    );
    // The leg defaults an absent code to 0n on the wire.
    expect(captured.swapExactIn?.[5]).toBe(0n);
  });
});
