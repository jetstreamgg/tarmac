/// <reference types="vite/client" />

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StUsdsProviderType, StUsdsDirection } from '@/hooks';

const captured = {
  batchStUsdsDeposit: undefined as Record<string, unknown> | undefined,
  curveSwaps: [] as Record<string, unknown>[]
};

const curveWithdrawParams = () =>
  captured.curveSwaps.find(params => params.direction === StUsdsDirection.WITHDRAW);

vi.mock('@/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hooks')>();
  return {
    ...actual,
    useBatchStUsdsDeposit: (params: Record<string, unknown>) => {
      captured.batchStUsdsDeposit = params;
      return {};
    },
    useStUsdsWithdraw: () => ({}),
    useBatchCurveSwap: (params: Record<string, unknown>) => {
      captured.curveSwaps.push(params);
      return {};
    }
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

describe('useStUsdsTransactions Curve withdraw slippage baseline', () => {
  const curveWithdrawParamsBase = {
    ...baseParams,
    selectedProvider: StUsdsProviderType.CURVE,
    referralCode: undefined,
    stUsdsAmount: 900n * 10n ** 18n
  };

  beforeEach(() => {
    captured.curveSwaps = [];
  });

  // The UI amount and the routed quote are seeded by separate provider selections and can
  // disagree on a max withdraw. minOut must track the quote whose stUsdsAmount is being swapped.
  it('uses the routed quote output as the slippage baseline, not the UI amount', () => {
    renderHook(() =>
      useStUsdsTransactions({
        ...curveWithdrawParamsBase,
        amount: 995n * 10n ** 18n,
        expectedOutput: 1000n * 10n ** 18n
      })
    );

    expect(curveWithdrawParams()?.expectedOutput).toBe(1000n * 10n ** 18n);
  });

  it('stays disabled when the routed quote output is unavailable', () => {
    renderHook(() =>
      useStUsdsTransactions({
        ...curveWithdrawParamsBase,
        amount: 995n * 10n ** 18n,
        expectedOutput: 0n
      })
    );

    expect(curveWithdrawParams()?.enabled).toBe(false);
  });
});
