import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { ReadHook } from '../hooks';
import { MORPHO_API_URL } from './constants';
import { useChainId } from 'wagmi';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { mainnet } from 'viem/chains';

type MorphoVaultApiResponse = {
  data: {
    vaultV2ByAddress: {
      address: string;
      avgApy: number;
      avgNetApy: number;
      performanceFee: number;
      managementFee: number;
    } | null;
  };
};

export type MorphoVaultRateData = {
  /** Native APY (before performance fee) as a decimal (e.g., 0.05 for 5%) */
  rate: number;
  /** Net APY (after performance fee, including rewards) as a decimal */
  netRate: number;
  /** Management fee as a decimal */
  managementFee: number;
  /** Performance fee as a decimal */
  performanceFee: number;
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
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      avgApy
      avgNetApy
      performanceFee
      managementFee
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

  if (!result.data.vaultV2ByAddress) {
    return undefined;
  }

  const { avgApy, avgNetApy, managementFee, performanceFee } = result.data.vaultV2ByAddress;

  return {
    rate: avgApy,
    netRate: avgNetApy,
    managementFee,
    performanceFee,
    formattedRate: `${(avgApy * 100).toFixed(2)}%`,
    formattedNetRate: `${(avgNetApy * 100).toFixed(2)}%`
  };
}

export function useMorphoVaultRate({ vaultAddress }: { vaultAddress: `0x${string}` }): MorphoVaultRateHook {
  const connectedChainId = useChainId();
  const chainId = isTestnetId(connectedChainId) ? mainnet.id : connectedChainId;

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
