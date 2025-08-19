import { useReadContract } from 'wagmi';
import { mkrSkyAbi, mkrSkyAddress } from '../generated';
import { useChainId } from 'wagmi';

/**
 * Hook to fetch the current MKR to SKY conversion rate from the mkrSky contract
 * @returns The current conversion rate (how many SKY tokens per 1 MKR)
 */
export function useMkrSkyRate() {
  const chainId = useChainId();

  return useReadContract({
    address: mkrSkyAddress[chainId as keyof typeof mkrSkyAddress],
    abi: mkrSkyAbi,
    functionName: 'rate',
    chainId,
    query: {
      // Cache for 1 minute since rate changes are rare
      staleTime: 60 * 1000,
      refetchInterval: 60 * 1000,
      // Enable refetch on window focus to ensure rate is current
      refetchOnWindowFocus: true
    }
  });
}
