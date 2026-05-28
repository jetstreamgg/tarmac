/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StUsdsProviderType } from '@/hooks';

const captured = {
  batchStUsdsDeposit: undefined as Record<string, unknown> | undefined
};

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useBatchStUsdsDeposit: (params: Record<string, unknown>) => {
      captured.batchStUsdsDeposit = params;
      return {};
    },
    useStUsdsWithdraw: () => ({}),
    useBatchCurveSwap: () => ({})
  };
});

vi.mock('./useStUsdsTransactionCallbacks', () => ({
  useStUsdsTransactionCallbacks: () => ({
    supplyTransactionCallbacks: {},
    withdrawTransactionCallbacks: {}
  })
}));

import { useStUsdsTransactions } from './useStUsdsTransactions';

const baseParams = {
  amount: 1_000_000n,
  max: false,
  needsAllowance: false,
  shouldUseBatch: false,
  mutateNativeSupplyAllowance: vi.fn(),
  mutateStUsds: vi.fn(),
  mutateCurveUsdsAllowance: vi.fn(),
  mutateCurveStUsdsAllowance: vi.fn(),
  selectedProvider: StUsdsProviderType.NATIVE,
  expectedOutput: 0n
};

describe('useStUsdsTransactions referralCode contract-arg', () => {
  beforeEach(() => {
    captured.batchStUsdsDeposit = undefined;
  });

  it('passes referralCode under `referral:` as a number', () => {
    renderHook(() => useStUsdsTransactions({ ...baseParams, referralCode: 12345 }));
    expect(captured.batchStUsdsDeposit?.referral).toBe(12345);
    expect(typeof captured.batchStUsdsDeposit?.referral).toBe('number');
  });

  it('forwards undefined when referralCode is undefined', () => {
    renderHook(() => useStUsdsTransactions({ ...baseParams, referralCode: undefined }));
    expect(captured.batchStUsdsDeposit?.referral).toBeUndefined();
  });
});
