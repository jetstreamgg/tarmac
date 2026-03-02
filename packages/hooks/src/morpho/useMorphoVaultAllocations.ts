import { useQuery } from '@tanstack/react-query';
import { useChainId, usePublicClient } from 'wagmi';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import {
  MORPHO_API_URL,
  MORPHO_VAULT_V1_ADAPTER_ABI,
  MorphoAdapterType,
  VAULT_V2_ADAPTERS_QUERY
} from './constants';
import { isTestnetId, formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { PublicClient } from 'viem';
import type {
  MorphoIdleLiquidityAllocation,
  MorphoV1VaultAllocation,
  MorphoVaultAllocationsData,
  MorphoVaultAllocationsHook,
  MorphoVaultV2AdaptersApiResponse
} from './morpho';
import { fetchV1VaultBasicData, readV1VaultFromAdapter } from './helpers';

/**
 * Fetch V2 vault V1 vault allocations and idle liquidity.
 *
 * V2 vaults can allocate to V1 vaults via MetaMorpho adapters.
 * Market allocations are handled separately by useMorphoVaultMarketApiData.
 *
 * This function:
 * 1. Queries the V2 vault to get its adapters
 * 2. For MetaMorpho adapters: reads the adapter contract to get V1 vault address and fetches vault data
 * 3. Returns V1 vault allocations and idle liquidity
 */
async function fetchMorphoVaultAllocations(
  vaultAddress: string,
  chainId: number,
  publicClient: PublicClient
): Promise<MorphoVaultAllocationsData | undefined> {
  // Step 1: Get V2 vault adapters from API
  const v2Response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_V2_ADAPTERS_QUERY,
      variables: {
        address: vaultAddress.toLowerCase(),
        chainId
      }
    })
  });

  if (!v2Response.ok) {
    throw new Error(`Morpho API error: ${v2Response.status}`);
  }

  const v2Result: MorphoVaultV2AdaptersApiResponse = await v2Response.json();

  if (!v2Result.data.vaultV2ByAddress) {
    return undefined;
  }

  const { adapters, totalAssets, totalAssetsUsd, asset, idleAssetsUsd } = v2Result.data.vaultV2ByAddress;
  const assetDecimals = asset.decimals;
  const assetSymbol = asset.symbol;

  // Filter adapters by type
  const metaMorphoAdapters = adapters.items.filter(adapter => adapter.type === MorphoAdapterType.MetaMorpho);

  // Build idle liquidity allocation (always show it, even if 0)
  // Note: idleAssetsUsd from the API is the source of truth for idle liquidity
  // We estimate the raw asset amount from USD value if needed
  const idleAssets =
    idleAssetsUsd > 0 && totalAssetsUsd > 0
      ? (BigInt(totalAssets) * BigInt(Math.round(idleAssetsUsd * 1e6))) /
        BigInt(Math.round(totalAssetsUsd * 1e6))
      : BigInt(0);
  const idleLiquidity: MorphoIdleLiquidityAllocation[] = [
    {
      assetSymbol,
      formattedAssets: formatBigInt(idleAssets, { unit: assetDecimals, compact: true }),
      formattedAssetsUsd: `$${formatNumber(idleAssetsUsd, { compact: true })}`,
      idleAssetsUsd
    }
  ];

  if (metaMorphoAdapters.length === 0) {
    return {
      v1Vaults: [],
      markets: [],
      idleLiquidity,
      assetSymbol
    };
  }

  // Calculate asset price per unit using total vault data
  const assetPriceUsd = totalAssetsUsd > 0 ? totalAssetsUsd / Number(totalAssets) : 0;

  // Step 2: Process MetaMorpho adapters (V1 vaults)
  const v1Vaults: MorphoV1VaultAllocation[] = [];

  // Read each adapter contract to get the underlying V1 vault address and real assets
  const v1VaultAddressPromises = metaMorphoAdapters.map(adapter =>
    readV1VaultFromAdapter(publicClient, adapter.address as `0x${string}`)
  );
  const v1VaultAddresses = await Promise.all(v1VaultAddressPromises);

  // Read real assets from each adapter in parallel
  const realAssetsResults = await publicClient.multicall({
    contracts: metaMorphoAdapters.map(adapter => ({
      address: adapter.address as `0x${string}`,
      abi: MORPHO_VAULT_V1_ADAPTER_ABI,
      functionName: 'realAssets' as const
    }))
  });

  // Create a map of V1 vault address to (real assets, real assets USD)
  type V1VaultInfo = {
    realAssets: bigint;
    realAssetsUsd: number;
  };
  const v1VaultInfoMap = new Map<string, V1VaultInfo>();
  metaMorphoAdapters.forEach((adapter, index) => {
    const v1Address = v1VaultAddresses[index];
    const realAssetsResult = realAssetsResults[index];
    if (v1Address && realAssetsResult.status === 'success') {
      const realAssets = realAssetsResult.result as bigint;
      const realAssetsUsd = Number(realAssets) * assetPriceUsd;
      v1VaultInfoMap.set(v1Address.toLowerCase(), {
        realAssets,
        realAssetsUsd
      });
    }
  });

  // Filter out any null addresses (failed reads)
  const validV1Vaults = v1VaultAddresses.filter((addr): addr is `0x${string}` => addr !== null);

  if (validV1Vaults.length > 0) {
    // Query each V1 vault for its basic data (name, symbol, APY) via API
    const v1VaultPromises = validV1Vaults.map(v1Address => fetchV1VaultBasicData(v1Address, chainId));
    const v1VaultResults = await Promise.all(v1VaultPromises);

    // Build V1 vault allocations
    for (let i = 0; i < v1VaultResults.length; i++) {
      const v1Vault = v1VaultResults[i];
      if (!v1Vault) continue;

      const v1VaultAddress = validV1Vaults[i];
      const vaultInfo = v1VaultInfoMap.get(v1VaultAddress.toLowerCase());

      if (!vaultInfo) continue;

      v1Vaults.push({
        vaultAddress: v1VaultAddress,
        vaultName: v1Vault.name,
        formattedAssets: formatBigInt(vaultInfo.realAssets, { unit: assetDecimals, compact: true }),
        formattedAssetsUsd: `$${formatNumber(vaultInfo.realAssetsUsd, { compact: true })}`,
        formattedNetApy: `${(v1Vault.state.netApy * 100).toFixed(2)}%`
      });
    }

    // Sort V1 vaults by real assets (highest first)
    v1Vaults.sort((a, b) => {
      const aAssets = v1VaultInfoMap.get(a.vaultAddress.toLowerCase())?.realAssets ?? 0n;
      const bAssets = v1VaultInfoMap.get(b.vaultAddress.toLowerCase())?.realAssets ?? 0n;
      return Number(bAssets - aAssets);
    });
  }

  return {
    v1Vaults,
    markets: [],
    idleLiquidity,
    assetSymbol
  };
}

/**
 * Hook for fetching Morpho V2 vault V1 allocations and idle liquidity.
 *
 * V2 vaults can allocate to V1 vaults via MetaMorpho adapters.
 * Market allocations are handled separately by useMorphoVaultMarketApiData.
 *
 * This hook:
 * 1. Queries the Morpho API to get adapter addresses
 * 2. For MetaMorpho adapters: reads the adapter contract and fetches V1 vault data
 * 3. Returns V1 vault allocations and idle liquidity
 *
 * @param vaultAddress - The Morpho V2 vault contract address (required)
 */
export function useMorphoVaultAllocations({
  vaultAddress
}: {
  vaultAddress: `0x${string}`;
}): MorphoVaultAllocationsHook {
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? mainnet.id : connectedChainId;
  const publicClient = usePublicClient({ chainId });

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-allocations', vaultAddress, chainId],
    queryFn: () => {
      if (!publicClient) {
        throw new Error('Public client not available');
      }
      return fetchMorphoVaultAllocations(vaultAddress, chainId, publicClient);
    },
    enabled: !!publicClient,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  return {
    data,
    isLoading: !data && isLoading,
    error: error as Error | null,
    mutate,
    dataSources: [
      {
        title: 'Morpho API',
        href: MORPHO_API_URL,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
