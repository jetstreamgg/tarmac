/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TokenForChain } from '@/hooks';

const captured: {
  swapExactIn: Record<string, unknown> | undefined;
  swapExactOut: Record<string, unknown> | undefined;
} = {
  swapExactIn: undefined,
  swapExactOut: undefined
};

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useBatchPsmSwapExactIn: (params: Record<string, unknown>) => {
      captured.swapExactIn = params;
      return {};
    },
    useBatchPsmSwapExactOut: (params: Record<string, unknown>) => {
      captured.swapExactOut = params;
      return {};
    }
  };
});

vi.mock('./useL2TradeTransactionCallbacks', () => ({
  useL2TradeTransactionCallbacks: () => ({
    tradeTransactionCallbacks: {},
    tradeOutTransactionCallbacks: {}
  })
}));

import { useL2TradeTransactions } from './useL2TradeTransactions';

const TOKEN_A: TokenForChain = {
  address: '0x000000000000000000000000000000000000000a',
  decimals: 18,
  symbol: 'A',
  name: 'TokenA'
} as unknown as TokenForChain;

const TOKEN_B: TokenForChain = {
  address: '0x000000000000000000000000000000000000000b',
  decimals: 18,
  symbol: 'B',
  name: 'TokenB'
} as unknown as TokenForChain;

const baseParams = {
  originAmount: 1_000_000n,
  originToken: TOKEN_A,
  targetToken: TOKEN_B,
  targetAmount: 1_000_000n,
  maxAmountInForWithdraw: 0n,
  shouldUseBatch: false,
  swapData: {},
  mutateAllowance: vi.fn(),
  mutateOriginBalance: vi.fn(),
  mutateTargetBalance: vi.fn(),
  setShowAddToken: vi.fn()
};

describe('useL2TradeTransactions referralCode contract-arg', () => {
  beforeEach(() => {
    captured.swapExactIn = undefined;
    captured.swapExactOut = undefined;
  });

  it('passes referralCode under `referralCode:` as BigInt (PSM swap exact-in)', () => {
    renderHook(() => useL2TradeTransactions({ ...baseParams, referralCode: 12345 }));
    expect(captured.swapExactIn?.referralCode).toBe(12345n);
    expect(typeof captured.swapExactIn?.referralCode).toBe('bigint');
  });

  it('passes referralCode under `referralCode:` as BigInt (PSM swap exact-out)', () => {
    renderHook(() => useL2TradeTransactions({ ...baseParams, referralCode: 12345 }));
    expect(captured.swapExactOut?.referralCode).toBe(12345n);
    expect(typeof captured.swapExactOut?.referralCode).toBe('bigint');
  });

  it('forwards undefined when referralCode is undefined (truthy gate)', () => {
    renderHook(() => useL2TradeTransactions({ ...baseParams, referralCode: undefined }));
    expect(captured.swapExactIn?.referralCode).toBeUndefined();
  });
});
