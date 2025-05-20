import { ReadHook } from '../hooks';
import { useQuery } from '@tanstack/react-query';
import { TRUST_LEVELS, TrustLevelEnum } from '../constants';

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

const fetchDelegateMetadata = async (url?: string) => {
  const response = await fetch(url || 'https://vote.sky.money/api/delegates/info'); //to test with tenderly, switch to https://governance-portal-v2-git-tenderly-delegate-4c3fd5-dux-core-unit.vercel.app/api/delegates/info?network=tenderly
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

export function useDelegateMetadataMapping(
  url?: string,
  enabled: boolean = true
): UseDelegateMetadataMappingResponse {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['delegate-metadata', url],
    queryFn: () => fetchDelegateMetadata(url),
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
