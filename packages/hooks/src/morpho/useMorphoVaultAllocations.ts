import { useQuery } from '@tanstack/react-query';
import { useChainId, usePublicClient } from 'wagmi';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL } from './constants';
import { isTestnetId, formatBigInt, formatNumber } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';
import { PublicClient } from 'viem';

/**
 * Minimal ABI for MorphoVaultV1Adapter to read the underlying V1 vault address.
 */
const MORPHO_VAULT_V1_ADAPTER_ABI = [
  {
    inputs: [],
    name: 'morphoVaultV1',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/**
 * API response type for Morpho V2 vault adapters query.
 */
type MorphoVaultV2AdaptersApiResponse = {
  data: {
    vaultV2ByAddress: {
      address: string;
      symbol: string;
      asset: {
        symbol: string;
        decimals: number;
      };
      totalAssets: string;
      totalAssetsUsd: number;
      /** Idle (undeployed) assets in USD */
      idleAssetsUsd: number;
      adapters: {
        items: Array<{
          address: string;
          assets: string;
          assetsUsd: number;
          type: string;
        }>;
      };
    } | null;
  };
};

/**
 * API response type for Morpho V1 vault basic data query (name only, no allocations).
 */
type MorphoVaultV1BasicDataApiResponse = {
  data: {
    vaultByAddress: {
      address: string;
      name: string;
      symbol: string;
      state: {
        netApy: number;
      };
    } | null;
  };
};

/** V1 vault allocation from the V2 vault */
export type MorphoV1VaultAllocation = {
  /** V1 vault contract address */
  vaultAddress: `0x${string}`;
  /** V1 vault name (e.g., "Steakhouse USDC") */
  vaultName: string;
  /** Formatted assets allocation (e.g., "5.93M") */
  formattedAssets: string;
  /** Formatted assets in USD (e.g., "$5.93M") */
  formattedAssetsUsd: string;
  /** Formatted net APY (e.g., "3.68%") */
  formattedNetApy: string;
};

/** Idle liquidity allocation (direct market exposure without collateral) */
export type MorphoIdleLiquidityAllocation = {
  /** Asset symbol (e.g., "USDC") */
  assetSymbol: string;
  /** Formatted assets allocation (e.g., "0") */
  formattedAssets: string;
  /** Formatted assets in USD (e.g., "$0") */
  formattedAssetsUsd: string;
};

export type MorphoVaultAllocationsData = {
  /** List of V1 vault allocations */
  v1Vaults: MorphoV1VaultAllocation[];
  /** Idle liquidity allocations */
  idleLiquidity: MorphoIdleLiquidityAllocation[];
  /** Asset symbol (e.g., "USDC") */
  assetSymbol: string;
};

export type MorphoVaultAllocationsHook = ReadHook & {
  data?: MorphoVaultAllocationsData;
};

/**
 * GraphQL query for Morpho V2 vault adapters.
 * V2 vaults allocate to V1 vaults through adapters.
 */
const VAULT_V2_ADAPTERS_QUERY = `
  query VaultV2Adapters($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      symbol
      asset {
        symbol
        decimals
      }
      totalAssets
      totalAssetsUsd
      idleAssetsUsd
      adapters {
        items {
          address
          assets
          assetsUsd
          type
        }
      }
    }
  }
`;

/**
 * GraphQL query for Morpho V1 vault basic data (name, symbol, net APY).
 */
const VAULT_V1_BASIC_DATA_QUERY = `
  query VaultV1BasicData($address: String!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      state {
        netApy
      }
    }
  }
`;

/**
 * Read the underlying V1 vault address from a MorphoVaultV1Adapter contract.
 */
async function readV1VaultFromAdapter(
  publicClient: PublicClient,
  adapterAddress: `0x${string}`
): Promise<`0x${string}` | null> {
  try {
    const v1VaultAddress = await publicClient.readContract({
      address: adapterAddress,
      abi: MORPHO_VAULT_V1_ADAPTER_ABI,
      functionName: 'morphoVaultV1'
    });
    return v1VaultAddress as `0x${string}`;
  } catch (error) {
    console.error(`Failed to read V1 vault from adapter ${adapterAddress}:`, error);
    return null;
  }
}

/**
 * Fetch V1 vault basic data (name, symbol, APY).
 */
async function fetchV1VaultBasicData(
  vaultAddress: string,
  chainId: number
): Promise<MorphoVaultV1BasicDataApiResponse['data']['vaultByAddress']> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_V1_BASIC_DATA_QUERY,
      variables: {
        address: vaultAddress.toLowerCase(),
        chainId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultV1BasicDataApiResponse = await response.json();
  return result.data.vaultByAddress;
}

/**
 * Fetch V2 vault direct allocations (V1 vaults and idle liquidity).
 *
 * V2 vaults allocate to V1 vaults via adapters. This function:
 * 1. Queries the V2 vault to get its adapters
 * 2. For MetaMorpho adapters: reads the adapter contract to get V1 vault address
 * 3. Queries each V1 vault's basic data (name, symbol, APY) via API
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
  const metaMorphoAdapters = adapters.items.filter(adapter => adapter.type === 'MetaMorpho');

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

  if (metaMorphoAdapters.length === 0) {
    return {
      v1Vaults: [],
      idleLiquidity,
      assetSymbol
    };
  }

  // Step 2: Read each adapter contract to get the underlying V1 vault address
  const v1VaultAddressPromises = metaMorphoAdapters.map(adapter =>
    readV1VaultFromAdapter(publicClient, adapter.address as `0x${string}`)
  );
  const v1VaultAddresses = await Promise.all(v1VaultAddressPromises);

  // Create a map of adapter address to adapter data for later lookup
  const adapterDataMap = new Map<string, (typeof metaMorphoAdapters)[0]>();
  metaMorphoAdapters.forEach((adapter, index) => {
    const v1Address = v1VaultAddresses[index];
    if (v1Address) {
      adapterDataMap.set(v1Address.toLowerCase(), adapter);
    }
  });

  // Filter out any null addresses (failed reads)
  const validV1Vaults = v1VaultAddresses.filter((addr): addr is `0x${string}` => addr !== null);

  if (validV1Vaults.length === 0) {
    return {
      v1Vaults: [],
      idleLiquidity,
      assetSymbol
    };
  }

  // Step 3: Query each V1 vault for its basic data (name, symbol, APY) via API
  const v1VaultPromises = validV1Vaults.map(v1Address => fetchV1VaultBasicData(v1Address, chainId));
  const v1VaultResults = await Promise.all(v1VaultPromises);

  // Step 4: Build V1 vault allocations
  const v1Vaults: MorphoV1VaultAllocation[] = [];

  for (let i = 0; i < v1VaultResults.length; i++) {
    const v1Vault = v1VaultResults[i];
    if (!v1Vault) continue;

    const v1VaultAddress = validV1Vaults[i];
    const adapterData = adapterDataMap.get(v1VaultAddress.toLowerCase());

    if (!adapterData) continue;

    const assetsBigInt = BigInt(adapterData.assets);

    v1Vaults.push({
      vaultAddress: v1VaultAddress,
      vaultName: v1Vault.name,
      formattedAssets: formatBigInt(assetsBigInt, { unit: assetDecimals, compact: true }),
      formattedAssetsUsd: `$${formatNumber(adapterData.assetsUsd, { compact: true })}`,
      formattedNetApy: `${(v1Vault.state.netApy * 100).toFixed(2)}%`
    });
  }

  // Sort V1 vaults by assets USD (highest first)
  v1Vaults.sort((a, b) => {
    const aUsd = adapterDataMap.get(a.vaultAddress.toLowerCase())?.assetsUsd ?? 0;
    const bUsd = adapterDataMap.get(b.vaultAddress.toLowerCase())?.assetsUsd ?? 0;
    return bUsd - aUsd;
  });

  return {
    v1Vaults,
    idleLiquidity,
    assetSymbol
  };
}

/**
 * Hook for fetching Morpho V2 vault direct allocations (V1 vaults and idle liquidity).
 *
 * V2 vaults allocate to V1 vaults via MetaMorpho adapters. This hook:
 * 1. Queries the Morpho API to get adapter addresses
 * 2. Reads each adapter contract to get the underlying V1 vault address
 * 3. Queries each V1 vault's data (name, symbol, market allocations) via API
 * 4. Returns hierarchical data: V1 vaults with their market exposures
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
