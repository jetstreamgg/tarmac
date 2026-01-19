import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL } from './constants';

type MorphoVaultAllocationsApiResponse = {
  data: {
    vaultByAddress: {
      address: string;
      state: {
        allocation: Array<{
          market: {
            uniqueKey: string;
            loanAsset: {
              address: string;
              symbol: string;
              decimals: number;
            };
            collateralAsset: {
              address: string;
              symbol: string;
              decimals: number;
            } | null;
            lltv: string;
            state: {
              supplyApy: number;
            };
          };
          supplyAssets: string;
          supplyAssetsUsd: number;
          supplyQueueIndex: number;
          withdrawQueueIndex: number;
        }>;
      };
    } | null;
  };
};

export type MorphoMarketAllocation = {
  /** Unique market identifier */
  marketId: string;
  /** Loan asset symbol (e.g., USDC) */
  loanAssetSymbol: string;
  /** Loan asset address */
  loanAssetAddress: string;
  /** Collateral asset symbol (e.g., WETH), null for idle markets */
  collateralAssetSymbol: string | null;
  /** Collateral asset address, null for idle markets */
  collateralAssetAddress: string | null;
  /** Liquidation loan-to-value ratio as a string (e.g., "0.86") */
  lltv: string;
  /** Formatted LLTV percentage (e.g., "86%") */
  formattedLltv: string;
  /** Supply APY for this market as a decimal */
  supplyApy: number;
  /** Formatted supply APY (e.g., "5.00%") */
  formattedSupplyApy: string;
  /** Assets allocated to this market (raw string from API) */
  supplyAssets: string;
  /** Assets allocated to this market in USD */
  supplyAssetsUsd: number;
  /** Position in the supply queue */
  supplyQueueIndex: number;
  /** Position in the withdraw queue */
  withdrawQueueIndex: number;
  /** Percentage of total vault assets allocated to this market */
  allocationPercentage: number;
  /** Formatted allocation percentage (e.g., "25.50%") */
  formattedAllocationPercentage: string;
};

export type MorphoVaultAllocationsData = {
  /** List of market allocations */
  allocations: MorphoMarketAllocation[];
  /** Total number of markets the vault is allocated to */
  totalMarkets: number;
};

export type MorphoVaultAllocationsHook = ReadHook & {
  data?: MorphoVaultAllocationsData;
};

const VAULT_ALLOCATIONS_QUERY = `
  query VaultAllocations($address: String!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      state {
        allocation {
          market {
            uniqueKey
            loanAsset {
              address
              symbol
              decimals
            }
            collateralAsset {
              address
              symbol
              decimals
            }
            lltv
            state {
              supplyApy
            }
          }
          supplyAssets
          supplyAssetsUsd
          supplyQueueIndex
          withdrawQueueIndex
        }
      }
    }
  }
`;

async function fetchMorphoVaultAllocations(
  vaultAddress: string,
  chainId: number
): Promise<MorphoVaultAllocationsData | undefined> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_ALLOCATIONS_QUERY,
      variables: {
        address: vaultAddress.toLowerCase(),
        chainId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultAllocationsApiResponse = await response.json();

  if (!result.data.vaultByAddress) {
    return undefined;
  }

  const { allocation } = result.data.vaultByAddress.state;

  // Calculate total USD value for percentage calculations
  const totalUsd = allocation.reduce((sum, alloc) => sum + alloc.supplyAssetsUsd, 0);

  const allocations: MorphoMarketAllocation[] = allocation.map(alloc => {
    const allocationPercentage = totalUsd > 0 ? (alloc.supplyAssetsUsd / totalUsd) * 100 : 0;
    const lltvNumber = parseFloat(alloc.market.lltv);

    return {
      marketId: alloc.market.uniqueKey,
      loanAssetSymbol: alloc.market.loanAsset.symbol,
      loanAssetAddress: alloc.market.loanAsset.address,
      collateralAssetSymbol: alloc.market.collateralAsset?.symbol ?? null,
      collateralAssetAddress: alloc.market.collateralAsset?.address ?? null,
      lltv: alloc.market.lltv,
      formattedLltv: `${(lltvNumber * 100).toFixed(0)}%`,
      supplyApy: alloc.market.state.supplyApy,
      formattedSupplyApy: `${(alloc.market.state.supplyApy * 100).toFixed(2)}%`,
      supplyAssets: alloc.supplyAssets,
      supplyAssetsUsd: alloc.supplyAssetsUsd,
      supplyQueueIndex: alloc.supplyQueueIndex,
      withdrawQueueIndex: alloc.withdrawQueueIndex,
      allocationPercentage,
      formattedAllocationPercentage: `${allocationPercentage.toFixed(2)}%`
    };
  });

  // Sort by allocation percentage (highest first)
  allocations.sort((a, b) => b.allocationPercentage - a.allocationPercentage);

  return {
    allocations,
    totalMarkets: allocations.length
  };
}

export function useMorphoVaultAllocations({
  vaultAddress
}: {
  vaultAddress: `0x${string}`;
}): MorphoVaultAllocationsHook {
  const chainId = useChainId();

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-allocations', vaultAddress, chainId],
    queryFn: () => fetchMorphoVaultAllocations(vaultAddress, chainId),
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
