import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL } from './constants';

type MorphoVaultApiResponse = {
  data: {
    vaultByAddress: {
      address: string;
      state: {
        apy: number;
        netApy: number;
        fee: number;
      };
    } | null;
  };
};

export type MorphoVaultRateData = {
  /** Native APY (before performance fee) as a decimal (e.g., 0.05 for 5%) */
  rate: number;
  /** Net APY (after performance fee, including rewards) as a decimal */
  netRate: number;
  /** Performance fee as a decimal */
  fee: number;
  /** Formatted APY string for display (e.g., "5.00%") */
  formattedRate: string;
  /** Formatted Net APY string for display */
  formattedNetRate: string;
};

export type MorphoVaultRateHook = ReadHook & {
  data?: MorphoVaultRateData;
};

const VAULT_RATE_QUERY = `
  query VaultRate($address: String!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      state {
        apy
        netApy
        fee
      }
    }
  }
`;

async function fetchMorphoVaultRate(
  vaultAddress: string,
  chainId: number
): Promise<MorphoVaultRateData | undefined> {
  const response = await fetch(MORPHO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: VAULT_RATE_QUERY,
      variables: {
        address: vaultAddress.toLowerCase(),
        chainId
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Morpho API error: ${response.status}`);
  }

  const result: MorphoVaultApiResponse = await response.json();

  if (!result.data.vaultByAddress) {
    return undefined;
  }

  const { apy, netApy, fee } = result.data.vaultByAddress.state;

  return {
    rate: apy,
    netRate: netApy,
    fee,
    formattedRate: `${(apy * 100).toFixed(2)}%`,
    formattedNetRate: `${(netApy * 100).toFixed(2)}%`
  };
}

export function useMorphoVaultRate({
  vaultAddress,
  chainId = 1
}: {
  vaultAddress: `0x${string}`;
  chainId?: number;
}): MorphoVaultRateHook {
  const {
    data,
    error,
    refetch: mutate,
    isLoading
  } = useQuery({
    queryKey: ['morpho-vault-rate', vaultAddress, chainId],
    queryFn: () => fetchMorphoVaultRate(vaultAddress, chainId),
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
        href: 'https://api.morpho.org/graphql',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
