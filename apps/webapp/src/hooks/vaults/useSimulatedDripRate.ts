import { useChainId, usePublicClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { mcdJugAbi, mcdJugAddress } from '../generated';

/**
 * The ilk's accumulated rate as `jug.drip` would leave it now. The vat's stored
 * rate lags until someone drips, so debt read from it is under-stated by the
 * fee accrued since; a max borrow computed from it can fail the vat's safety
 * check once the tx itself drips.
 */
export function useSimulatedDripRate(ilkHex: `0x${string}`) {
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId });
  const jugAddress = mcdJugAddress[chainId as keyof typeof mcdJugAddress];

  return useQuery({
    queryKey: ['simulateDrip', ilkHex, chainId],
    queryFn: async () => {
      const { result } = await publicClient!.simulateContract({
        address: jugAddress,
        abi: mcdJugAbi,
        functionName: 'drip',
        args: [ilkHex],
        account: '0x0000000000000000000000000000000000000000'
      });
      return result;
    },
    enabled: !!publicClient && !!jugAddress
  });
}
