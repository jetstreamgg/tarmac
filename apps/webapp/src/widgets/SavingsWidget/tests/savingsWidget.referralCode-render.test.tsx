/// <reference types="vite/client" />

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { REFERRAL_CODE } from '@/lib/constants';

const captured = vi.hoisted(() => ({ params: undefined as Record<string, unknown> | undefined }));

vi.mock('@/widgets/SavingsWidget/hooks/useSavingsTransactions', () => ({
  useSavingsTransactions: (params: Record<string, unknown>) => {
    captured.params = params;
    return {
      batchSavingsSupply: {
        prepared: false,
        isLoading: false,
        error: null,
        execute: () => {},
        currentCallIndex: 0,
        reset: () => {}
      },
      batchUpgradeAndSupply: {
        prepared: false,
        isLoading: false,
        error: null,
        execute: () => {},
        currentCallIndex: 0,
        reset: () => {}
      },
      savingsWithdraw: {
        prepared: false,
        isLoading: false,
        error: null,
        execute: () => {},
        currentCallIndex: 0,
        reset: () => {}
      }
    };
  }
}));

import { SavingsWidget } from '..';

describe('SavingsWidget referralCode render-layer parity', () => {
  beforeEach(() => {
    captured.params = undefined;
  });

  it('passes REFERRAL_CODE constant to useSavingsTransactions', async () => {
    render(<SavingsWidget />, { wrapper: WagmiWrapper });
    await waitFor(() => {
      expect(captured.params).toBeDefined();
    });
    expect(captured.params?.referralCode).toBe(REFERRAL_CODE);
    expect(typeof captured.params?.referralCode).toBe('number');
  });
});
