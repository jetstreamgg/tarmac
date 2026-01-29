import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL, MORPHO_VAULTS, VAULT_V2_POSITIONS_QUERY } from './constants';
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

    // Add addresses (lowercase for consistency)
    items.forEach(item => allAddresses.add(item.user.address.toLowerCase()));

    skip += PAGE_SIZE;
    hasMorePages = items.length === PAGE_SIZE;
  }

  return Array.from(allAddresses);
}

async function fetchAllMorphoVaultSupplierAddresses(chainId: number): Promise<string[]> {
  const allAddresses = new Set<string>();

  // Fetch positions from all configured Morpho vaults
  await Promise.all(
    MORPHO_VAULTS.map(async vault => {
      const vaultAddress = vault.vaultAddress[chainId];
      if (!vaultAddress) return;

      try {
        const addresses = await fetchMorphoVaultSupplierAddresses(vaultAddress, chainId);
        addresses.forEach(addr => allAddresses.add(addr));
      } catch (error) {
        console.error(`Failed to fetch positions for vault ${vault.name}:`, error);
      }
    })
  );

  return Array.from(allAddresses);
}

export type MorphoVaultSupplierAddressesHook = ReadHook & {
  data?: string[];
};

export function useMorphoVaultSupplierAddresses({
  vaultAddress
}: {
  vaultAddress?: `0x${string}`;
} = {}): MorphoVaultSupplierAddressesHook {
  // Always use mainnet chainId since Morpho vaults are only on mainnet
  const chainId = mainnet.id;

  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-supplier-addresses', vaultAddress || 'all', chainId],
    queryFn: () =>
      vaultAddress
        ? fetchMorphoVaultSupplierAddresses(vaultAddress, chainId)
        : fetchAllMorphoVaultSupplierAddresses(chainId),
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
