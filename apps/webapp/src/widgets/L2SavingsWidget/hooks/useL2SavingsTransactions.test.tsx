/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TOKENS } from '@/hooks';

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

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

vi.mock('./useL2SavingsTransactionCallbacks', () => ({
  useL2SavingsTransactionCallbacks: () => ({
    supplyTransactionCallbacks: {},
    withdrawTransactionCallbacks: {}
  })
}));

import { useL2SavingsTransactions } from './useL2SavingsTransactions';

const baseParams = {
  originToken: TOKENS.usds,
  amount: 1_000_000n,
  isMaxWithdraw: false,
  supplyMinAmountOut: 0n,
  minAmountOutForWithdrawAll: 0n,
  maxAmountInForWithdraw: 0n,
  shouldUseBatch: false,
  needsAllowance: false,
  mutateAllowance: vi.fn(),
  mutateOriginBalance: vi.fn(),
  sUsdsBalance: 0n,
  mutateSUsdsBalance: vi.fn()
};

describe('useL2SavingsTransactions referralCode contract-arg', () => {
  beforeEach(() => {
    captured.swapExactIn = undefined;
    captured.swapExactOut = undefined;
  });

  it('passes referralCode under `referralCode:` as BigInt (PSM swap exact-in)', () => {
    renderHook(() => useL2SavingsTransactions({ ...baseParams, referralCode: 12345 }));
    expect(captured.swapExactIn?.referralCode).toBe(12345n);
    expect(typeof captured.swapExactIn?.referralCode).toBe('bigint');
  });

  it('passes referralCode under `referralCode:` as BigInt (PSM swap exact-out)', () => {
    renderHook(() => useL2SavingsTransactions({ ...baseParams, referralCode: 12345 }));
    expect(captured.swapExactOut?.referralCode).toBe(12345n);
    expect(typeof captured.swapExactOut?.referralCode).toBe('bigint');
  });

  it('forwards undefined when referralCode is undefined or zero (truthy gate)', () => {
    renderHook(() => useL2SavingsTransactions({ ...baseParams, referralCode: undefined }));
    expect(captured.swapExactIn?.referralCode).toBeUndefined();
  });
});
