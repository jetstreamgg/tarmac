/// <reference types="vite/client" />

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { REFERRAL_CODE } from '@/lib/constants';

const captured = vi.hoisted(() => ({ params: undefined as Record<string, unknown> | undefined }));

vi.mock('@/widgets/PsmConversionWidget/hooks/usePsmConversion', () => ({
  usePsmConversion: (params: Record<string, unknown>) => {
    captured.params = params;
    return {
      direction: 'USDC_TO_USDS',
      chainId: 1,
      isL2: false,
      isMainnetWrapper: true,
      originAmount: 0n,
      targetAmount: 0n,
      hasNonZeroFee: false,
      isDirectionHalted: false,
      needsAllowance: false,
      shouldUseBatch: false,
      mutateAllowance: () => {},
      mutatePocketBalance: () => {},
      prepared: false,
      isLoading: false,
      error: null,
      execute: () => {},
      currentCallIndex: 0,
      reset: () => {},
      execution: { l2AmountIn: 0n, l2MinAmountOut: 0n, mainnetGemAmt: 0n, mainnetUsdsAmountInWad: 0n }
    };
  }
}));

import { PsmConversionWidget } from '..';

describe('PsmConversionWidget referralCode render-layer parity', () => {
  beforeEach(() => {
    captured.params = undefined;
  });

  it('passes REFERRAL_CODE constant to usePsmConversion', async () => {
    render(<PsmConversionWidget />, { wrapper: WagmiWrapper });
    await waitFor(() => {
      expect(captured.params).toBeDefined();
    });
    expect(captured.params?.referralCode).toBe(REFERRAL_CODE);
    expect(typeof captured.params?.referralCode).toBe('number');
  });
});
