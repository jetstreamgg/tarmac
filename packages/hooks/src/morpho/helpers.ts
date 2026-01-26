import { PublicClient } from 'viem';
import {
  MARKET_DATA_QUERY,
  MORPHO_API_URL,
  MORPHO_MARKET_V1_ADAPTER_ABI,
  MORPHO_VAULT_V1_ADAPTER_ABI,
  VAULT_V1_BASIC_DATA_QUERY
} from './constants';
import type { MorphoVaultV1BasicDataApiResponse } from './morpho';

/**
 * Read the underlying V1 vault address from a MorphoVaultV1Adapter contract.
 */
export async function readV1VaultFromAdapter(
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
 * Read all market IDs from a MorphoMarketV1Adapter contract.
 * Each adapter can allocate to multiple markets.
 */
export async function readMarketIdsFromAdapter(
  publicClient: PublicClient,
  adapterAddress: `0x${string}`
): Promise<string[]> {
  try {
    // First, read how many market IDs this adapter has
    const length = await publicClient.readContract({
      address: adapterAddress,
      abi: MORPHO_MARKET_V1_ADAPTER_ABI,
      functionName: 'marketIdsLength'
    });

    const marketIdsLength = Number(length);
    if (marketIdsLength === 0) {
      return [];
    }

    // Then, read all market IDs in a single multicall
    const marketIds = await publicClient.multicall({
      contracts: Array.from({ length: marketIdsLength }, (_, index) => ({
        address: adapterAddress,
        abi: MORPHO_MARKET_V1_ADAPTER_ABI,
        functionName: 'marketIds' as const,
        args: [BigInt(index)]
      }))
    });

    return marketIds.filter(result => result.status === 'success').map(result => result.result as string);
  } catch (error) {
    console.error(`Failed to read market IDs from adapter ${adapterAddress}:`, error);
    return [];
  }
}

/**
 * API response type for Morpho market data query.
 */
type MorphoMarketDataApiResponse = {
  data: {
    marketByUniqueKey: {
      uniqueKey: string;
      loanAsset: {
        symbol: string;
      };
      collateralAsset: {
        symbol: string;
      };
      state: {
        supplyAssets: string;
        borrowAssets: string;
        utilization: number;
        avgNetSupplyApy: number;
      };
    } | null;
  };
};

/**
 * Fetch V1 vault basic data (name, symbol, APY).
 */
export async function fetchV1VaultBasicData(
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
 * Fetch Morpho market data (loan asset, collateral asset, APY).
 */
export async function fetchMarketData(
  marketId: string,
  chainId: number
): Promise<MorphoMarketDataApiResponse['data']['marketByUniqueKey']> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: MARKET_DATA_QUERY,
      variables: {
        marketId,
        chainId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoMarketDataApiResponse = await response.json();
  return result.data.marketByUniqueKey;
}
