/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TOKENS } from '@/hooks';

const captured = {
  batchSavingsSupply: undefined as Record<string, unknown> | undefined,
  batchUpgradeAndSavingsSupply: undefined as Record<string, unknown> | undefined,
  savingsWithdraw: undefined as Record<string, unknown> | undefined
};

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useBatchSavingsSupply: (params: Record<string, unknown>) => {
      captured.batchSavingsSupply = params;
      return {};
    },
    useBatchUpgradeAndSavingsSupply: (params: Record<string, unknown>) => {
      captured.batchUpgradeAndSavingsSupply = params;
      return {};
    },
    useSavingsWithdraw: (params: Record<string, unknown>) => {
      captured.savingsWithdraw = params;
      return {};
    }
  };
});

vi.mock('../lib/constants', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/constants')>();
  return { ...actual };
});

vi.mock('./useSavingsTransactionCallbacks', () => ({
  useSavingsTransactionCallbacks: () => ({
    supplyTransactionCallbacks: {},
    withdrawTransactionCallbacks: {}
  })
}));

import { useSavingsTransactions } from './useSavingsTransactions';

const baseParams = {
  amount: 1_000_000n,
  max: false,
  originToken: TOKENS.usds,
  shouldUseBatch: false,
  assetDecimals: 18,
  assetSymbol: 'USDS',
  assetAddress: '0x0' as `0x${string}`,
  needsAllowance: false,
  mutateAllowance: vi.fn(),
  mutateSavings: vi.fn(),
  mutateOriginBalance: vi.fn()
};

describe('useSavingsTransactions referralCode contract-arg', () => {
  beforeEach(() => {
    captured.batchSavingsSupply = undefined;
    captured.batchUpgradeAndSavingsSupply = undefined;
    captured.savingsWithdraw = undefined;
  });

  it('passes referralCode under `ref:` as a number (Savings supply)', () => {
    renderHook(() => useSavingsTransactions({ ...baseParams, referralCode: 12345 }));
    expect(captured.batchSavingsSupply?.ref).toBe(12345);
    expect(typeof captured.batchSavingsSupply?.ref).toBe('number');
  });

  it('passes referralCode under `ref:` as a number (UpgradeAndSavingsSupply)', () => {
    renderHook(() => useSavingsTransactions({ ...baseParams, referralCode: 12345 }));
    expect(captured.batchUpgradeAndSavingsSupply?.ref).toBe(12345);
    expect(typeof captured.batchUpgradeAndSavingsSupply?.ref).toBe('number');
  });

  it('forwards undefined when referralCode is undefined', () => {
    renderHook(() => useSavingsTransactions({ ...baseParams, referralCode: undefined }));
    expect(captured.batchSavingsSupply?.ref).toBeUndefined();
  });
});
