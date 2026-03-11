import { useMemo } from 'react';
import { useReadContracts, useConnection, useChainId } from 'wagmi';
import { usdsRiskCapitalVaultAbi } from '../generated';
import { MORPHO_VAULTS } from './constants';
import { MorphoVaultConfig } from './morpho';
import { ZERO_ADDRESS } from '../constants';
import { chainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { ReadHook } from '../hooks';
import { Token } from '../tokens/types';

function getTokenDecimals(decimals: number | Record<number, number>, forChainId: number): number {
  if (typeof decimals === 'number') return decimals;
  return decimals[forChainId] ?? 18;
}

/** Individual vault balance data */
export type MorphoVaultBalance = {
  /** Vault configuration */
  vault: MorphoVaultConfig;
  /** Vault contract address */
  vaultAddress: `0x${string}`;
  /** User's balance in the vault's asset (native decimals) */
  balance: bigint;
  /** User's balance normalized to 18 decimals (WAD) */
  balanceNormalized: bigint;
  /** The asset token for this vault */
  assetToken: Token;
};

/** Return type for useAllMorphoVaultsUserAssets */
export type AllMorphoVaultsUserAssetsData = {
  /** Total user assets across all vaults, normalized to 18 decimals (WAD) */
  total: bigint;
  /** Individual vault balances */
  vaults: MorphoVaultBalance[];
};

/**
 * Hook that aggregates user assets across all Morpho vaults.
 * Returns both the total user-supplied value and individual vault balances.
 */
export function useAllMorphoVaultsUserAssets(): ReadHook & { data: AllMorphoVaultsUserAssetsData } {
  const { address: userAddress } = useConnection();
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;

  const vaultsWithAddress = useMemo(
    () =>
      MORPHO_VAULTS.map(vault => ({
        vault,
        address: vault.vaultAddress[chainIdToUse]
      })).filter(
        (v): v is { vault: (typeof MORPHO_VAULTS)[number]; address: `0x${string}` } => !!v.address
      ),
    [chainIdToUse]
  );

  const contracts = useMemo(
    () =>
      vaultsWithAddress.flatMap(({ address }) => {
        const base = { address, abi: usdsRiskCapitalVaultAbi, chainId: chainIdToUse } as const;
        return [
          { ...base, functionName: 'balanceOf' as const, args: [userAddress || ZERO_ADDRESS] },
          { ...base, functionName: 'convertToAssets' as const, args: [10n ** 18n] },
          { ...base, functionName: 'decimals' as const }
        ];
      }),
    [vaultsWithAddress, chainIdToUse, userAddress]
  );

  const {
    data,
    isLoading,
    error,
    refetch: mutate
  } = useReadContracts({
    contracts,
    query: { enabled: !!userAddress && contracts.length > 0 }
  });

  const assetsData = useMemo((): AllMorphoVaultsUserAssetsData => {
    if (!data) return { total: 0n, vaults: [] };

    let total = 0n;
    const vaults: MorphoVaultBalance[] = [];

    for (let i = 0; i < vaultsWithAddress.length; i++) {
      const idx = i * 3;
      const sharesResult = data[idx];
      const assetPerShareResult = data[idx + 1];
      const decimalsResult = data[idx + 2];

      const { vault, address } = vaultsWithAddress[i];

      if (
        sharesResult?.status === 'success' &&
        assetPerShareResult?.status === 'success' &&
        decimalsResult?.status === 'success'
      ) {
        const shares = sharesResult.result as bigint;
        const assetPerShare = assetPerShareResult.result as bigint;
        const shareDecimals = decimalsResult.result as number;

        // userAssets in the asset's native decimals
        const userAssets = shares > 0n ? (shares * assetPerShare) / 10n ** BigInt(shareDecimals) : 0n;

        // Normalize to 18 decimals
        const assetDecimals = getTokenDecimals(vault.assetToken.decimals, chainIdToUse);
        const normalized =
          assetDecimals < 18 ? userAssets * 10n ** BigInt(18 - assetDecimals) : userAssets;

        total += normalized;

        vaults.push({
          vault,
          vaultAddress: address,
          balance: userAssets,
          balanceNormalized: normalized,
          assetToken: vault.assetToken
        });
      }
    }

    return { total, vaults };
  }, [data, vaultsWithAddress, chainIdToUse]);

  return {
    data: assetsData,
    isLoading,
    error: error || null,
    mutate,
    dataSources: []
  };
}
