import { useConnection, useChainId } from 'wagmi';
import { proxyRegistryAddress, useReadProxyRegistry } from '../generated';
import { ReadHook } from '../hooks';
import { getEtherscanLink } from '@jetstreamgg/sky-utils';
import { TrustLevelEnum, TRUST_LEVELS, ZERO_ADDRESS } from '../constants';

export type DsProxyHookData = {
  owner?: `0x${string}`;
  dsProxyAddress?: `0x${string}`;
};

export type DsProxyHookResponse = ReadHook & {
  data?: DsProxyHookData;
};

export function useDsProxyData(owner?: `0x${string}`): DsProxyHookResponse {
  const chainId = useChainId();
  const { address: connectedAddress } = useConnection();

  // Use either a provided owner address, or the connected address if none provided
  const acct = owner || connectedAddress || ZERO_ADDRESS;

  const contractAddress = proxyRegistryAddress[chainId as keyof typeof proxyRegistryAddress];

  const {
    data: dsProxyAddress,
    isLoading,
    error,
    refetch
  } = useReadProxyRegistry({
    functionName: 'proxies',
    args: [acct],
    chainId: chainId as any,
    query: {
      staleTime: 30_000,
      enabled: acct && acct !== ZERO_ADDRESS
    }
  });

  return {
    data: {
      owner: acct,
      dsProxyAddress: dsProxyAddress !== ZERO_ADDRESS ? (dsProxyAddress as `0x${string}`) : undefined
    },
    isLoading,
    error,
    mutate: refetch,
    dataSources: contractAddress
      ? [
          {
            title: 'Proxy Registry Contract. (proxies)',
            onChain: true,
            href: getEtherscanLink(chainId, contractAddress, 'address'),
            trustLevel: TRUST_LEVELS[TrustLevelEnum.ZERO]
          }
        ]
      : []
  };
}
