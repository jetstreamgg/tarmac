import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL, VAULT_V2_POSITIONS_QUERY } from './constants';
import { mainnet } from 'viem/chains';

const PAGE_SIZE = 1000;

type MorphoVaultPositionsApiResponse = {
  data: {
    vaultV2ByAddress: {
      positions: {
        items: Array<{
          user: {
            address: string;
          };
          shares: string;
        }>;
      };
    } | null;
  };
};

async function fetchMorphoVaultSupplierAddresses(vaultAddress: string, chainId: number): Promise<string[]> {
  const allAddresses = new Set<string>();
  let skip = 0;
  let hasMorePages = true;

  while (hasMorePages) {
    const response = await fetch(MORPHO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: VAULT_V2_POSITIONS_QUERY,
        variables: {
          address: vaultAddress.toLowerCase(),
          chainId,
          first: PAGE_SIZE,
          skip
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Morpho API error: ${response.status}`);
    }

    const result: MorphoVaultPositionsApiResponse = await response.json();
    const items = result.data.vaultV2ByAddress?.positions?.items || [];

    // Filter for active suppliers (shares > 0) - API doesn't support server-side filtering
    items.forEach(item => {
      if (BigInt(item.shares) > 0n) {
        allAddresses.add(item.user.address.toLowerCase());
      }
    });

    skip += PAGE_SIZE;
    hasMorePages = items.length === PAGE_SIZE;
  }

  return Array.from(allAddresses);
}

export type MorphoVaultSupplierAddressesHook = ReadHook & {
  data?: string[];
};

export function useMorphoVaultSupplierAddresses({
  vaultAddress
}: {
  vaultAddress: `0x${string}`;
}): MorphoVaultSupplierAddressesHook {
  // Always use mainnet chainId since Morpho vaults are only on mainnet
  const chainId = mainnet.id;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-supplier-addresses', vaultAddress, chainId],
    queryFn: () => fetchMorphoVaultSupplierAddresses(vaultAddress, chainId),
    staleTime: 10 * 60 * 1000, // 10 minutes - supplier lists don't change rapidly
    gcTime: 15 * 60 * 1000 // 15 minutes
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
