import { useCapabilities, useChainId } from 'wagmi';
import { CapabilitySupportStatus } from './constants';
import { ReadHook } from '../hooks';
import { TRUST_LEVELS } from '../constants';

export function useIsBatchSupported(): ReadHook & {
  data?: boolean;
} {
  const chainId = useChainId();

  const {
    data: capabilities,
    isLoading,
    error,
    refetch
  } = useCapabilities({
    query: {
      // A wallet that doesn't implement EIP-5792 rejects `wallet_getCapabilities`
      // outright. That's a definitive answer, not a transient failure — but
      // react-query's default is three retries with 1s/2s/4s backoff, so the probe
      // stays `isLoading` for the better part of ten seconds before settling on the
      // "no" it already had. Ask once.
      retry: false,
      // Batching support doesn't change under a live session, and the query key
      // already carries the connector and account — a wallet or account switch gets
      // a fresh key. Keeping the answer means the probe is a wallet round trip once
      // per connection instead of on every flow that mounts cold, and any later
      // background revalidation resolves against retained data, so `isLoading` never
      // goes true a second time.
      staleTime: 5 * 60 * 1000,
      gcTime: Infinity
    }
  });

  const atomicCapabilityStatus = capabilities?.[chainId]?.atomic?.status;
  // The pre-v2 draft of EIP-5792. The Safe connector (`safe-apps-provider`) answers with this
  // one only, so the fallback below is what keeps Safe bundling.
  const atomicBatchSupported: boolean | undefined = capabilities?.[chainId]?.atomicBatch?.supported;

  // When the wallet reports `atomic`, it decides. Ambire answers `atomicBatch: true` for every
  // account, plain EOAs included, then runs the bundle as separate transactions, gas-estimating
  // each leg before the previous one has landed (APP-637). Its `atomic` status is accurate.
  const supported =
    atomicCapabilityStatus !== undefined
      ? atomicCapabilityStatus === CapabilitySupportStatus.supported ||
        atomicCapabilityStatus === CapabilitySupportStatus.ready
      : atomicBatchSupported;

  return {
    data: isLoading || error ? undefined : supported,
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
