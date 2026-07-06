import { describe, expect, it, afterAll } from 'vitest';
import { cleanup, waitFor, renderHook } from '@testing-library/react';
import { WagmiWrapper } from '../../../test/hooks';

import { useErc4626VaultData } from './useErc4626VaultData';
import { usdsRiskCapitalVaultAddress } from '../generated';
import { TENDERLY_CHAIN_ID } from '../constants';

// NOTE: this slice's target vault (Spark sUSDT, 0x74cb…0DAa) is NOT deployed at the
// hooks-suite fork's pinned block — verified on-chain (the vault address returns no
// bytecode while USDT and the Morpho vaults do). `useErc4626VaultData` is
// provider-neutral, so we exercise the new on-chain `max*` reads against a real
// Morpho ERC-4626 vault that IS present on the fork: it walks the identical generic
// code path. The real Spark vault is covered by the operator-run e2e once the
// e2e fork is refreshed past the vault's deployment block.
const MORPHO_VAULT_ADDRESS = usdsRiskCapitalVaultAddress[TENDERLY_CHAIN_ID];

describe('useErc4626VaultData (on-chain ERC-4626 reads incl. max* limits)', () => {
  it('returns a loading state initially', () => {
    const { result } = renderHook(() => useErc4626VaultData({ vaultAddress: MORPHO_VAULT_ADDRESS }), {
      wrapper: WagmiWrapper
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('reads vault + user data and parses the ERC-4626 max* limits as bigints', async () => {
    const { result } = renderHook(() => useErc4626VaultData({ vaultAddress: MORPHO_VAULT_ADDRESS }), {
      wrapper: WagmiWrapper
    });

    // Wait until the connected user's limits are read (max* live in the user batch).
    await waitFor(
      () => {
        expect(result.current.data).toBeDefined();
        expect(result.current.data?.maxDeposit).toBeDefined();
      },
      { timeout: 30000 }
    );

    const data = result.current.data!;

    // Vault-level reads
    expect(data.totalAssets).toBeGreaterThanOrEqual(0n);
    expect(data.asset).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(typeof data.decimals).toBe('number');
    expect(data.decimals).toBeGreaterThan(0);

    // User-level reads
    expect(data.userShares).toBeGreaterThanOrEqual(0n);
    expect(data.userAssets).toBeGreaterThanOrEqual(0n);

    // New on-chain limits read by this slice — present and parsed as bigints.
    expect(typeof data.maxDeposit).toBe('bigint');
    expect(typeof data.maxWithdraw).toBe('bigint');
    expect(typeof data.maxRedeem).toBe('bigint');
    expect(data.maxDeposit!).toBeGreaterThanOrEqual(0n);
    expect(data.maxWithdraw!).toBeGreaterThanOrEqual(0n);
    expect(data.maxRedeem!).toBeGreaterThanOrEqual(0n);
  });

  afterAll(() => {
    cleanup();
  });
});
