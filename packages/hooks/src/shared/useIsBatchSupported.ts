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
  // Safe wallets use `atomicBatch` capabilities
  const atomicBatchSupported: boolean | undefined = capabilities?.[chainId]?.atomicBatch?.supported;

  return {
    data:
      isLoading || error
        ? undefined
        : atomicCapabilityStatus === CapabilitySupportStatus.supported ||
          atomicCapabilityStatus === CapabilitySupportStatus.ready ||
          atomicBatchSupported,
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
