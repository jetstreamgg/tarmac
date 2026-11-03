import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { ReadHook } from '../hooks';
import { getEtherscanLink } from '@/utils';
import { TRUST_LEVELS, TrustLevelEnum, ZERO_ADDRESS } from '../constants';

export type UseTokenAllowanceResponse = ReadHook & {
  data?: bigint;
};

export function useTokenAllowance({
  chainId,
  contractAddress,
  owner,
  spender
}: {
  chainId: number;
  contractAddress?: `0x${string}`;
  owner?: `0x${string}`;
  spender?: `0x${string}`;
}): UseTokenAllowanceResponse {
  const {
    data: allowance,
    refetch,
    isLoading,
    isFetchedAfterMount,
    error
  } = useReadContract({
    address: contractAddress,
    abi: erc20Abi,
    chainId: chainId,
    functionName: 'allowance',
    args: [owner || ZERO_ADDRESS, spender || ZERO_ADDRESS],
    query: {
      enabled: !!contractAddress && !!owner && !!spender,
      staleTime: 30_000,
      refetchOnMount: 'always'
    }
  });

  return {
    // A cached value can predate a spend (APP-675): engines decide their approve
    // from this, so they wait for a read made since they mounted.
    data: isFetchedAfterMount && !error ? allowance : undefined,
    mutate: refetch,
    isLoading,
    error,
    dataSources: contractAddress
      ? [
          {
            title: 'ERC20 Token Contract',
            onChain: true,
            href: getEtherscanLink(chainId, contractAddress, 'address'),
            trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
          }
        ]
      : []
  };
}
