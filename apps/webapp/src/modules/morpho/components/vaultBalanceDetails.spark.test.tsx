/// <reference types="vite/client" />

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WagmiWrapper } from '../../../../test/widgets/WagmiWrapper';

const VAULT = '0x74cb54e082411cfCAEADb00a0765625B10410DAa';

// The "Your balances" row renders Supplied + Remaining for every provider, but the
// Accumulated Rewards card sources from Morpho/Merkl — there is no Spark rewards
// program, so it must be hidden for non-Morpho vaults (it errored "Unable to fetch
// balance" on the Spark vault). Drive the seam hooks so we assert what renders.
const onChainData = {
  data: { userAssets: 1_000_000n, userShares: 1_000_000n, decimals: 6 },
  isLoading: false,
  error: null
};
const tokenBalance = { data: { value: 2_000_000n }, isLoading: false, error: null };
const rewardsData = {
  data: { rewards: [] },
  isLoading: false,
  // A genuine Merkl failure for Spark — exactly the error this slice hides.
  error: new Error('Unable to fetch balance')
};

vi.mock('@/hooks', async importActual => {
  const actual = await importActual<typeof import('@/hooks')>();
  return {
    ...actual,
    useMorphoVaultOnChainData: () => onChainData,
    useTokenBalance: () => tokenBalance,
    useMorphoVaultRewards: () => rewardsData
  };
});

import { VaultBalanceDetails } from './VaultBalanceDetails';
import { TOKENS } from '@/hooks';

describe('VaultBalanceDetails (provider-aware rewards card)', () => {
  it('hides the Accumulated Rewards card for a Spark vault but keeps Supplied + Remaining', async () => {
    render(<VaultBalanceDetails vaultAddress={VAULT} assetToken={TOKENS.usdt} provider="sky" />, {
      wrapper: WagmiWrapper
    });

    // Core balances still render for Spark.
    expect(await screen.findByTestId('morpho-vault-supplied-balance-details')).toBeTruthy();
    expect(screen.getByTestId('morpho-vault-remaining-balance-details')).toBeTruthy();
    // The rewards card (and its "Unable to fetch balance" error) is gone for Spark.
    expect(screen.queryByText('Accumulated Rewards')).toBeNull();
    expect(screen.queryByText(/Unable to fetch balance/i)).toBeNull();
  });

  it('renders the Accumulated Rewards card for a Morpho vault (unchanged)', async () => {
    render(<VaultBalanceDetails vaultAddress={VAULT} assetToken={TOKENS.usdt} provider="morpho" />, {
      wrapper: WagmiWrapper
    });

    expect(await screen.findByTestId('morpho-vault-supplied-balance-details')).toBeTruthy();
    expect(screen.getByText('Accumulated Rewards')).toBeTruthy();
  });

  it('defaults to Morpho behavior when provider is omitted', async () => {
    render(<VaultBalanceDetails vaultAddress={VAULT} assetToken={TOKENS.usdt} />, {
      wrapper: WagmiWrapper
    });

    expect(await screen.findByText('Accumulated Rewards')).toBeTruthy();
  });
});
