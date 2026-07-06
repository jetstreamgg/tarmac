/// <reference types="vite/client" />

import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';
import { REFERRAL_CODE } from '@/lib/constants';

const captured = vi.hoisted(() => ({ params: undefined as Record<string, unknown> | undefined }));

const stubTxResult = {
  prepared: false,
  isLoading: false,
  error: null,
  prepareError: null,
  execute: () => {},
  currentCallIndex: 0,
  reset: () => {}
};

vi.mock('@/widgets/VaultWidget/hooks/useVaultTransactions', () => ({
  useVaultTransactions: (params: Record<string, unknown>) => {
    captured.params = params;
    return {
      morphoVaultDeposit: stubTxResult,
      morphoVaultWithdraw: stubTxResult,
      morphoVaultRedeem: stubTxResult
    };
  }
}));

import { VaultWidget } from '..';
import { TOKENS } from '@/hooks';

describe('VaultWidget referralCode render-layer parity', () => {
  beforeEach(() => {
    captured.params = undefined;
  });

  it('forwards provider="sky" and the REFERRAL_CODE constant to useVaultTransactions', async () => {
    render(
      <VaultWidget
        vaultAddress="0x74cb54e082411cfCAEADb00a0765625B10410DAa"
        assetAddress="0xdAC17F958D2ee523a2206206994597C13D831ec7"
        assetToken={TOKENS.usdt}
        vaultName="Tether Savings"
        provider="sky"
      />,
      { wrapper: WagmiWrapper }
    );

    await waitFor(() => {
      expect(captured.params).toBeDefined();
    });
    expect(captured.params?.provider).toBe('sky');
    expect(captured.params?.referralCode).toBe(REFERRAL_CODE);
    expect(typeof captured.params?.referralCode).toBe('number');
  });
});
