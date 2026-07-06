import { useMemo } from 'react';
import { useChainId, useReadContracts } from 'wagmi';
import { chainId, isTestnetId } from '@/utils';
import { buildVaultRatesByAddress, type VaultRateSource } from '@/lib/vaults/vaultRates';
import { sparkVaultAbi } from '@/hooks/abis/sparkVaultAbi';
import { useMorphoVaultMultipleRateApiData } from '../morpho/useMorphoVaultRateApiData';
import { VAULTS } from './constants';
import type { VaultProvider } from './types';

export type VaultRatesByAddressHook = {
  /** Lowercased vault address → net rate (decimal, e.g. 0.05 = 5%). */
  ratesByAddress: Map<string, number>;
  isLoading: boolean;
};

/**
 * Provider-neutral "rates over the registry" source: walks the unified vault
 * registry and returns each vault's rate via its Provider's own source — Morpho
 * via the Morpho rate API, Spark via the on-chain `vsr`. The balances card (and
 * any other consumer) stays ignorant of per-Provider rate origins; the next
 * Provider plugs in by registration plus a branch in `buildVaultRatesByAddress`.
 */
export function useVaultRatesByAddress(): VaultRatesByAddressHook {
  const connectedChainId = useChainId();
  const chainIdToUse = isTestnetId(connectedChainId) ? chainId.tenderly : chainId.mainnet;

  const byProvider = useMemo(() => {
    const partition: Record<VaultProvider, { address: `0x${string}` }[]> = { morpho: [], sky: [] };
    for (const vault of VAULTS) {
      const address = vault.vaultAddress[chainIdToUse];
      if (address) partition[vault.provider].push({ address });
    }
    return partition;
  }, [chainIdToUse]);

  const { data: morphoRates, isLoading: morphoLoading } = useMorphoVaultMultipleRateApiData({
    vaultAddresses: byProvider.morpho.map(v => v.address)
  });

  const sparkContracts = useMemo(
    () =>
      byProvider.sky.map(({ address }) => ({
        address,
        abi: sparkVaultAbi,
        functionName: 'vsr' as const,
        chainId: chainIdToUse
      })),
    [byProvider.sky, chainIdToUse]
  );

  const { data: sparkVsrResults, isLoading: sparkLoading } = useReadContracts({
    contracts: sparkContracts,
    query: { enabled: sparkContracts.length > 0 }
  });

  const ratesByAddress = useMemo(() => {
    const morphoRateByAddress = new Map((morphoRates || []).map(r => [r.address.toLowerCase(), r.netRate]));

    const sources: VaultRateSource[] = [
      ...byProvider.morpho.map(({ address }) => ({
        provider: 'morpho' as const,
        address,
        netRate: morphoRateByAddress.get(address.toLowerCase())
      })),
      ...byProvider.sky.map(({ address }, i) => ({
        provider: 'sky' as const,
        address,
        vsr: sparkVsrResults?.[i]?.status === 'success' ? (sparkVsrResults[i].result as bigint) : undefined
      }))
    ];

    return buildVaultRatesByAddress(sources);
  }, [morphoRates, sparkVsrResults, byProvider]);

  return { ratesByAddress, isLoading: morphoLoading || sparkLoading };
}
