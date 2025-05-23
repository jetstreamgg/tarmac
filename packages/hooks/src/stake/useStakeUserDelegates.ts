import { ReadHook } from '../hooks';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';
import { getMakerSubgraphUrl } from '../helpers/getSubgraphUrl';
import { useUserDelegates } from '../delegates/useUserDelegates';
import { useDelegates } from '../delegates/useDelegates';
import { DelegateInfo } from '../delegates/delegate';

export function useStakeUserDelegates({
  subgraphUrl,
  chainId,
  user,
  page = 1,
  pageSize = 100,
  random,
  search
}: {
  subgraphUrl?: string;
  chainId: number;
  user: `0x${string}`;
  page?: number;
  pageSize?: number;
  random?: boolean;
  search?: string;
}): ReadHook & { data?: DelegateInfo[] } {
  const urlSubgraph = subgraphUrl ? subgraphUrl : getMakerSubgraphUrl(chainId) || '';

  const {
    data: userDelegatesData,
    isLoading: isLoadingUserDelegates,
    error: errorUserDelegates,
    mutate: mutateUserDelegates
  } = useUserDelegates({ chainId, user: user || ZERO_ADDRESS, search, version: 3 });

  const totalUserDelegates = userDelegatesData?.length || 0;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const userDelegatesPage = userDelegatesData?.slice(startIndex, endIndex) || [];
  const remainingSlots = pageSize - userDelegatesPage.length;

  const excludeDelegates = userDelegatesData?.map(delegate => delegate.id);
  const {
    data: restDelegates,
    isLoading: isLoadingRestDelegates,
    error: errorRestDelegates,
    mutate: mutateRestDelegates
  } = useDelegates({
    chainId,
    exclude: excludeDelegates,
    page: Math.max(1, Math.ceil((startIndex - totalUserDelegates + 1) / pageSize)),
    pageSize: remainingSlots,
    random,
    search,
    version: 3
  });
  const isLoading = isLoadingUserDelegates || isLoadingRestDelegates;
  const isDataReady = user && user !== ZERO_ADDRESS && !isLoading && (userDelegatesData || restDelegates);

  return {
    isLoading,
    data: isDataReady ? [...userDelegatesPage, ...(restDelegates || [])] : undefined,
    error: errorUserDelegates || errorRestDelegates,
    mutate: () => {
      mutateUserDelegates();
      mutateRestDelegates();
    },
    dataSources: [
      {
        title: 'Sky Ecosystem subgraph',
        href: urlSubgraph,
        onChain: false,
        trustLevel: TRUST_LEVELS[TrustLevelEnum.ONE]
      }
    ]
  };
}
