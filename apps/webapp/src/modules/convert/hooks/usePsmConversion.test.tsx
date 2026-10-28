/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { base } from 'viem/chains';

const captured: { swapExactIn: Record<string, unknown> | undefined } = { swapExactIn: undefined };

vi.mock('@/hooks/psm/useBatchPsmSwapExactIn', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/psm/useBatchPsmSwapExactIn')>();
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
    }
  };
});
vi.mock('@/hooks/psm/useBatchUsdsPsmWrapperSellGem', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/psm/useBatchUsdsPsmWrapperSellGem')>();
  return {
    ...actual,
    useBatchUsdsPsmWrapperSellGem: () => ({
      prepared: false,
      isLoading: false,
      error: null,
      execute: () => {},
      currentCallIndex: 0,
      reset: () => {}
    })
  };
});
vi.mock('@/hooks/psm/useBatchUsdsPsmWrapperBuyGem', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/psm/useBatchUsdsPsmWrapperBuyGem')>();
  return {
    ...actual,
    useBatchUsdsPsmWrapperBuyGem: () => ({
      prepared: false,
      isLoading: false,
      error: null,
      execute: () => {},
      currentCallIndex: 0,
      reset: () => {}
    })
  };
});
vi.mock('@/hooks/tokens/useTokenAllowance', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/tokens/useTokenAllowance')>();
  return {
    ...actual,
    useTokenAllowance: () => ({ data: 0n, mutate: () => {} })
  };
});
vi.mock('@/hooks/shared/useIsBatchSupported', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/shared/useIsBatchSupported')>();
  return {
    ...actual,
    useIsBatchSupported: () => ({ data: false })
  };
});
vi.mock('@/hooks/psm/useUsdsPsmWrapperReads', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/psm/useUsdsPsmWrapperReads')>();
  return {
    ...actual,
    useUsdsPsmWrapperLive: () => ({ data: 1n, refetch: () => {} }),
    useUsdsPsmWrapperTin: () => ({ data: 0n, refetch: () => {} }),
    useUsdsPsmWrapperTout: () => ({ data: 0n, refetch: () => {} }),
    useUsdsPsmWrapperHalted: () => ({ data: 0n, refetch: () => {} })
  };
});
vi.mock('@/hooks/psm/usePsmPocketBalance', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/psm/usePsmPocketBalance')>();
  return {
    ...actual,
    usePsmPocketBalance: () => ({ data: undefined, refetch: () => {} })
  };
});
vi.mock('@/hooks/psm/usePsmLiquidity', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks/psm/usePsmLiquidity')>();
  return {
    ...actual,
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
