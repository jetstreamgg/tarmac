import { useQuery } from '@tanstack/react-query';
import { useChainId, usePublicClient } from 'wagmi';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import {
  MORPHO_API_URL,
  MORPHO_MARKET_V1_ADAPTER_ABI,
  MORPHO_VAULT_V1_ADAPTER_ABI,
  MorphoAdapterType,
  VAULT_V2_ADAPTERS_QUERY
} from './constants';
import { isTestnetId, formatBigInt, formatNumber, formatPercent } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { PublicClient } from 'viem';
import type {
  MorphoIdleLiquidityAllocation,
  MorphoMarketAllocation,
  MorphoV1VaultAllocation,
  MorphoVaultAllocationsData,
  MorphoVaultAllocationsHook,
  MorphoVaultV2AdaptersApiResponse
} from './morpho';
import {
  fetchMarketData,
  fetchV1VaultBasicData,
  readMarketIdsFromAdapter,
  readV1VaultFromAdapter
} from './helpers';

/**
 * Fetch V2 vault direct allocations (V1 vaults, direct markets, and idle liquidity).
 *
 * V2 vaults can allocate to:
 * - V1 vaults via MetaMorpho adapters
 * - Direct Morpho markets via MorphoMarketV1 adapters
 * - Idle liquidity (undeployed assets)
 *
 * This function:
 * 1. Queries the V2 vault to get its adapters
 * 2. For MetaMorpho adapters: reads the adapter contract to get V1 vault address and fetches vault data
 * 3. For MorphoMarketV1 adapters: reads the adapter contract to get market ID and fetches market data
 * 4. Returns direct allocations without drilling into V1 vault market exposures
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
  const morphoMarketAdapters = adapters.items.filter(
    adapter => adapter.type === MorphoAdapterType.MorphoMarketV1
  );

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
      formattedAssetsUsd: `$${formatNumber(idleAssetsUsd, { compact: true })}`
    }
  ];

  if (metaMorphoAdapters.length === 0 && morphoMarketAdapters.length === 0) {
    return {
      v1Vaults: [],
      markets: [],
      idleLiquidity,
      assetSymbol
    };
  }

  // Calculate asset price per unit using total vault data (used for V1 vaults and markets)
  const assetPriceUsd = totalAssetsUsd > 0 ? totalAssetsUsd / Number(totalAssets) : 0;

  // Step 2: Process MetaMorpho adapters (V1 vaults)
  const v1Vaults: MorphoV1VaultAllocation[] = [];

  if (metaMorphoAdapters.length > 0) {
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
  }

  // Step 3: Process MorphoMarketV1 adapters (direct markets)
  const markets: MorphoMarketAllocation[] = [];

  if (morphoMarketAdapters.length > 0) {
    // Read all market IDs from each adapter (each adapter can have multiple markets)
    const allMarketIdsPromises = morphoMarketAdapters.map(adapter =>
      readMarketIdsFromAdapter(publicClient, adapter.address as `0x${string}`)
    );
    const allMarketIdsArrays = await Promise.all(allMarketIdsPromises);

    // Read real assets from each adapter in parallel
    const realAssetsResults = await publicClient.multicall({
      contracts: morphoMarketAdapters.map(adapter => ({
        address: adapter.address as `0x${string}`,
        abi: MORPHO_MARKET_V1_ADAPTER_ABI,
        functionName: 'realAssets' as const
      }))
    });

    // Create a map of adapter address to (real assets, real assets USD)
    type AdapterRealAssets = {
      realAssets: bigint;
      realAssetsUsd: number;
    };
    const adapterRealAssetsMap = new Map<string, AdapterRealAssets>();
    morphoMarketAdapters.forEach((adapter, index) => {
      const realAssetsResult = realAssetsResults[index];
      if (realAssetsResult.status === 'success') {
        const realAssets = realAssetsResult.result as bigint;
        const realAssetsUsd = Number(realAssets) * assetPriceUsd;
        adapterRealAssetsMap.set(adapter.address.toLowerCase(), { realAssets, realAssetsUsd });
      }
    });

    // Build a list of (marketId, realAssets, realAssetsUsd) tuples
    type MarketAdapterPair = {
      marketId: string;
      realAssets: bigint;
      realAssetsUsd: number;
    };
    const marketAdapterPairs: MarketAdapterPair[] = [];

    morphoMarketAdapters.forEach((adapter, index) => {
      const marketIds = allMarketIdsArrays[index];
      const adapterAssets = adapterRealAssetsMap.get(adapter.address.toLowerCase());
      if (adapterAssets) {
        marketIds.forEach(marketId => {
          marketAdapterPairs.push({
            marketId,
            realAssets: adapterAssets.realAssets,
            realAssetsUsd: adapterAssets.realAssetsUsd
          });
        });
      }
    });

    if (marketAdapterPairs.length > 0) {
      // Get unique market IDs for fetching data
      const uniqueMarketIds = Array.from(new Set(marketAdapterPairs.map(pair => pair.marketId)));

      // Fetch market data for each unique market ID
      const marketDataPromises = uniqueMarketIds.map(marketId => fetchMarketData(marketId, chainId));
      const marketDataResults = await Promise.all(marketDataPromises);

      // Create a map of market ID to market data
      const marketDataMap = new Map<string, NonNullable<Awaited<ReturnType<typeof fetchMarketData>>>>();
      uniqueMarketIds.forEach((marketId, index) => {
        const marketData = marketDataResults[index];
        if (marketData) {
          marketDataMap.set(marketId, marketData);
        }
      });

      // Build market allocations
      for (const { marketId, realAssets, realAssetsUsd } of marketAdapterPairs) {
        const marketData = marketDataMap.get(marketId);
        if (!marketData) continue;

        const totalSupplyAssets = BigInt(marketData.state.supplyAssets);
        const totalBorrowAssets = BigInt(marketData.state.borrowAssets);
        const liquidity = totalSupplyAssets - totalBorrowAssets;

        markets.push({
          marketId,
          loanAsset: marketData.loanAsset.symbol,
          collateralAsset: marketData.collateralAsset.symbol,
          formattedAssets: formatBigInt(realAssets, { unit: assetDecimals, compact: true }),
          formattedAssetsUsd: `$${formatNumber(realAssetsUsd, { compact: true })}`,
          formattedNetApy: `${(marketData.state.avgNetSupplyApy * 100).toFixed(2)}%`,
          totalSupplyAssets,
          totalBorrowAssets,
          liquidity,
          utilization: marketData.state.utilization,
          lltv: BigInt(marketData.lltv),
          formattedLltv: formatPercent(BigInt(marketData.lltv), {
            maxDecimals: 0,
            showPercentageDecimals: false
          })
        });
      }

      // Sort markets by real assets (highest first)
      markets.sort((a, b) => {
        const aPair = marketAdapterPairs.find(p => p.marketId === a.marketId);
        const bPair = marketAdapterPairs.find(p => p.marketId === b.marketId);
        const aAssets = aPair?.realAssets ?? 0n;
        const bAssets = bPair?.realAssets ?? 0n;
        return Number(bAssets - aAssets);
      });
    }
  }

  return {
    v1Vaults,
    markets,
    idleLiquidity,
    assetSymbol
  };
}

/**
 * Hook for fetching Morpho V2 vault direct allocations (V1 vaults, direct markets, and idle liquidity).
 *
 * V2 vaults can allocate to:
 * - V1 vaults via MetaMorpho adapters
 * - Direct Morpho markets via MorphoMarketV1 adapters
 * - Idle liquidity (undeployed assets)
 *
 * This hook:
 * 1. Queries the Morpho API to get adapter addresses
 * 2. For MetaMorpho adapters: reads the adapter contract and fetches V1 vault data
 * 3. For MorphoMarketV1 adapters: reads the adapter contract and fetches market data
 * 4. Returns direct allocations without drilling into V1 vault market exposures
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
