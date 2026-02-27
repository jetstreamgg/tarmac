import { useMemo } from 'react';
import { useReadContracts, useChainId, useAccount } from 'wagmi';
import { usdsRiskCapitalVaultAbi } from '../generated';
import { MORPHO_VAULTS } from './constants';
import { chainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { ZERO_ADDRESS } from '../constants';

export type MorphoVaultUserData = {
  /** Vault address */
  vaultAddress: `0x${string}`;
  /** Vault name from config */
  vaultName: string;
  /** User's vault share balance */
  userShares: bigint;
  /** User's underlying asset value */
  userAssets: bigint;
};

export type MorphoVaultsCombinedUserData = {
  /** Combined user assets across all Morpho vaults */
  totalUserAssets: bigint;
  /** Per-vault user data */
  vaults: MorphoVaultUserData[];
  isLoading: boolean;
  error: Error | null;
};

/**
 * Hook that fetches user balance data for all configured Morpho vaults
 * and returns combined stats plus per-vault breakdown.
 */
export function useMorphoVaultsCombinedUserData(): MorphoVaultsCombinedUserData {
  const { address: userAddress } = useAccount();
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;

  // Build vault configs with addresses for the current chain
  const vaultConfigs = useMemo(
    () =>
      MORPHO_VAULTS.map(vault => ({
        name: vault.name,
        address: vault.vaultAddress[chainIdToUse] as `0x${string}` | undefined
      })).filter((v): v is { name: string; address: `0x${string}` } => !!v.address),
    [chainIdToUse]
  );

  // Fetch decimals and convertToAssets for each vault (needed to calculate userAssets)
  const {
    data: vaultData,
    isLoading: isVaultLoading,
    error: vaultError
  } = useReadContracts({
    contracts: vaultConfigs.flatMap(config => [
      {
        address: config.address,
        abi: usdsRiskCapitalVaultAbi,
        chainId: chainIdToUse,
        functionName: 'decimals' as const
      },
      {
        address: config.address,
        abi: usdsRiskCapitalVaultAbi,
        chainId: chainIdToUse,
        functionName: 'convertToAssets' as const,
        args: [10n ** 18n]
      }
    ]),
    query: {
      enabled: vaultConfigs.length > 0
    }
  });

  // Fetch user balances for each vault
  const {
    data: userData,
    isLoading: isUserLoading,
    error: userError
  } = useReadContracts({
    contracts: vaultConfigs.map(config => ({
      address: config.address,
      abi: usdsRiskCapitalVaultAbi,
      chainId: chainIdToUse,
      functionName: 'balanceOf' as const,
      args: [userAddress || ZERO_ADDRESS]
    })),
    query: {
      enabled: vaultConfigs.length > 0 && !!userAddress
    }
  });

  const result = useMemo<MorphoVaultsCombinedUserData>(() => {
    const isLoading = isVaultLoading || isUserLoading;
    const error = (vaultError || userError) as Error | null;

    if (!vaultData || !userData) {
      return {
        totalUserAssets: 0n,
        vaults: [],
        isLoading,
        error
      };
    }

    let totalUserAssets = 0n;
    const vaults: MorphoVaultUserData[] = [];

    for (let i = 0; i < vaultConfigs.length; i++) {
      const config = vaultConfigs[i];

      // Each vault has 2 entries in vaultData: decimals and convertToAssets
      const decimalsResult = vaultData[i * 2];
      const assetPerShareResult = vaultData[i * 2 + 1];
      const userSharesResult = userData[i];

      if (
        decimalsResult?.status !== 'success' ||
        assetPerShareResult?.status !== 'success' ||
        userSharesResult?.status !== 'success'
      ) {
        continue;
      }

      const decimals = decimalsResult.result as number;
      const assetPerShare = assetPerShareResult.result as bigint;
      const userShares = userSharesResult.result as bigint;

      // Calculate userAssets in asset's native decimals
      const userAssets = userShares > 0n ? (userShares * assetPerShare) / 10n ** 18n : 0n;

      // Normalize to 18 decimals before summing (handles USDT 6 decimals, USDS 18 decimals, etc.)
      totalUserAssets += userAssets * 10n ** BigInt(18 - decimals);
      vaults.push({
        vaultAddress: config.address,
        vaultName: config.name,
        userShares,
        userAssets
      });
    }

    return {
      totalUserAssets,
      vaults,
      isLoading,
      error
    };
  }, [vaultData, userData, vaultConfigs, isVaultLoading, isUserLoading, vaultError, userError]);

  return result;
}
