import { useCapabilities, useChainId } from 'wagmi';
import { CapabilitySupportStatus } from './constants';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS } from '../constants';

export function useIsBatchSupported(): ReadHook & {
  data?: boolean;
} {
  const chainId = useChainId();

  const { data: capabilities, isLoading, error, refetch } = useCapabilities();

  const atomicCapabilityStatus = capabilities?.[chainId]?.atomic?.status;

  return {
    data:
      isLoading || error
        ? undefined
        : atomicCapabilityStatus === CapabilitySupportStatus.supported ||
          atomicCapabilityStatus === CapabilitySupportStatus.ready,
    isLoading,
    error,
    mutate: refetch,
    dataSources: [
      {
        title: 'Wallet provider',
        onChain: false,
        href: 'https://wagmi.sh/react/api/hooks/useCapabilities',
        trustLevel: TRUST_LEVELS[1]
      }
    ]
  };
}
