import { useMemo } from 'react';
import { useReadContracts, useConnection, useChainId } from 'wagmi';
import { usdsRiskCapitalVaultAbi } from '../generated';
import { MORPHO_VAULTS } from './constants';
import { ZERO_ADDRESS } from '../constants';
import { chainId, isTestnetId } from '@jetstreamgg/sky-utils';
import { ReadHook } from '../hooks';

function getTokenDecimals(decimals: number | Record<number, number>, forChainId: number): number {
  if (typeof decimals === 'number') return decimals;
  return decimals[forChainId] ?? 18;
}

/**
 * Hook that aggregates user assets across all Morpho vaults.
 * Returns the total user-supplied value normalized to 18 decimals (WAD).
 */
export function useAllMorphoVaultsUserAssets(): ReadHook & { data: bigint } {
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

  const totalUserAssets = useMemo(() => {
    if (!data) return 0n;
    let total = 0n;
    for (let i = 0; i < vaultsWithAddress.length; i++) {
      const idx = i * 3;
      const sharesResult = data[idx];
      const assetPerShareResult = data[idx + 1];
      const decimalsResult = data[idx + 2];

      if (
        sharesResult?.status === 'success' &&
        assetPerShareResult?.status === 'success' &&
        decimalsResult?.status === 'success'
      ) {
        const shares = sharesResult.result as bigint;
        const assetPerShare = assetPerShareResult.result as bigint;
        const shareDecimals = decimalsResult.result as number;

        if (shares > 0n) {
          // userAssets in the asset's native decimals
          const userAssets = (shares * assetPerShare) / 10n ** BigInt(shareDecimals);

          // Normalize to 18 decimals
          const assetDecimals = getTokenDecimals(
            vaultsWithAddress[i].vault.assetToken.decimals,
            chainIdToUse
          );
          const normalized =
            assetDecimals < 18 ? userAssets * 10n ** BigInt(18 - assetDecimals) : userAssets;

          total += normalized;
        }
      }
    }
    return total;
  }, [data, vaultsWithAddress, chainIdToUse]);

  return {
    data: totalUserAssets,
    isLoading,
    error: error || null,
    mutate,
    dataSources: []
  };
}
