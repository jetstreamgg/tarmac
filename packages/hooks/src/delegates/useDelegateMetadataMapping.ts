import { ReadHook } from '../hooks';
import { useQuery } from '@tanstack/react-query';
import { TENDERLY_CHAIN_ID, TRUST_LEVELS, TrustLevelEnum } from '../constants';
import { useChainId } from 'wagmi';

type DelegateApiData = {
  name: string;
  picture: string;
  address: string;
  voteDelegateAddress: string;
  status: string;
  cuMember: boolean;
  pollParticipation: string;
  executiveParticipation: string;
  combinedParticipation: string;
  communication: string;
  blockTimestamp: string;
  expirationDate: string;
  expired: boolean;
  isAboutToExpire: boolean;
  previous: {
    address: string;
  };
  next: {
    address: string;
    voteDelegateAddress: string;
  };
};

const fetchDelegateMetadata = async (chainId: number) => {
  const networkSearchParam = chainId === TENDERLY_CHAIN_ID ? 'tenderly' : 'mainnet';
  const response = await fetch(`https://vote.sky.money/api/delegates/info?network=${networkSearchParam}`);
  const data: DelegateApiData[] = await response.json();

  // Transform into mapping from delegate address to name
  const delegateMapping = data.reduce((acc: Record<string, DelegateApiData>, delegate: DelegateApiData) => {
    acc[delegate.voteDelegateAddress.toLowerCase()] = delegate;
    if (delegate.next?.voteDelegateAddress) acc[delegate.next.voteDelegateAddress.toLowerCase()] = delegate;
    return acc;
  }, {});

  return delegateMapping;
};

type UseDelegateMetadataMappingResponse = ReadHook & {
  data:
    | {
        [key: string]: DelegateApiData;
      }
    | undefined;
};

export function useDelegateMetadataMapping(enabled: boolean = true): UseDelegateMetadataMappingResponse {
  const chainId = useChainId();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['delegate-metadata', chainId],
    queryFn: () => fetchDelegateMetadata(chainId),
    enabled
  });
  return {
    data,
    isLoading,
    error,
    mutate: refetch,
    dataSources: [
      {
        title: 'Governance Portal',
        href: 'vote.sky.money',
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.TWO]
      }
    ]
  };
}
