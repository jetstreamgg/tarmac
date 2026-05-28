/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const captured = {
  batchSupply: undefined as Record<string, unknown> | undefined
};

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useBatchRewardsSupply: (params: Record<string, unknown>) => {
      captured.batchSupply = params;
      return {};
    },
    useRewardsWithdraw: () => ({}),
    useRewardsClaim: () => ({}),
    useBatchClaimAllRewards: () => ({})
  };
});

vi.mock('wagmi', async importOriginal => {
  const actual = await importOriginal<typeof import('wagmi')>();
  return { ...actual, useChainId: () => 1 };
});

vi.mock('./useRewardsTransactionCallbacks', () => ({
  useRewardsTransactionCallbacks: () => ({
    supplyTransactionCallbacks: {},
    withdrawTransactionCallbacks: {},
    claimTransactionCallbacks: {},
    claimAllTransactionCallbacks: {}
  })
}));

import { useRewardsTransactions } from './useRewardsTransactions';

const baseParams = {
  selectedRewardContract: undefined,
  amount: 1_000_000n,
  rewardsBalance: 0n,
  needsAllowance: false,
  shouldUseBatch: false,
  mutateAllowance: vi.fn(),
  mutateTokenBalance: vi.fn(),
  mutateRewardsBalance: vi.fn(),
  mutateUserSuppliedBalance: vi.fn(),
  setClaimAmount: vi.fn()
};

describe('useRewardsTransactions referralCode contract-arg', () => {
  beforeEach(() => {
    captured.batchSupply = undefined;
  });

  it('passes referralCode under `ref:` as a number', () => {
    renderHook(() => useRewardsTransactions({ ...baseParams, referralCode: 12345 }));
    expect(captured.batchSupply?.ref).toBe(12345);
    expect(typeof captured.batchSupply?.ref).toBe('number');
  });

  it('forwards undefined when referralCode is undefined', () => {
    renderHook(() => useRewardsTransactions({ ...baseParams, referralCode: undefined }));
    expect(captured.batchSupply?.ref).toBeUndefined();
  });
});
