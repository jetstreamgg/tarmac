/// <reference types="vite/client" />

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { REFERRAL_CODE } from '@/lib/constants';

const captured = vi.hoisted(() => ({ params: undefined as Record<string, unknown> | undefined }));

vi.mock('@/widgets/L2TradeWidget/hooks/useL2TradeTransactions', () => ({
  useL2TradeTransactions: (params: Record<string, unknown>) => {
    captured.params = params;
    return {
      batchTrade: {
        prepared: false,
        isLoading: false,
        error: null,
        execute: () => {},
        currentCallIndex: 0,
        reset: () => {}
      },
      batchTradeOut: {
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

import { L2TradeWidget } from '..';

describe('L2TradeWidget referralCode render-layer parity', () => {
  beforeEach(() => {
    captured.params = undefined;
  });

  it('passes REFERRAL_CODE constant to useL2TradeTransactions', async () => {
    render(<L2TradeWidget />, { wrapper: WagmiWrapper });
    await waitFor(() => {
      expect(captured.params).toBeDefined();
    });
    expect(captured.params?.referralCode).toBe(REFERRAL_CODE);
    expect(typeof captured.params?.referralCode).toBe('number');
  });
});
