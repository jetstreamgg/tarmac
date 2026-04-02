import { useChainId, useReadContract } from 'wagmi';
import { usdsPsmWrapperAbi, usdsPsmWrapperAddress } from './usdsPsmWrapper';

function useUsdsPsmWrapperRead(functionName: 'tin' | 'tout' | 'live' | 'HALTED', chainIdOverride?: number) {
  const chainId = useChainId();
  const effectiveChainId = chainIdOverride ?? chainId;
  const address = usdsPsmWrapperAddress[effectiveChainId as keyof typeof usdsPsmWrapperAddress];

  return useReadContract({
    address,
    abi: usdsPsmWrapperAbi,
    functionName,
    chainId: effectiveChainId,
    query: {
      enabled: Boolean(address && effectiveChainId),
      staleTime: 30_000,
      refetchOnWindowFocus: true
    }
  });
}

export function useUsdsPsmWrapperTin({ chainIdOverride }: { chainIdOverride?: number } = {}) {
  return useUsdsPsmWrapperRead('tin', chainIdOverride);
}

export function useUsdsPsmWrapperTout({ chainIdOverride }: { chainIdOverride?: number } = {}) {
  return useUsdsPsmWrapperRead('tout', chainIdOverride);
}

export function useUsdsPsmWrapperLive({ chainIdOverride }: { chainIdOverride?: number } = {}) {
  return useUsdsPsmWrapperRead('live', chainIdOverride);
}

export function useUsdsPsmWrapperHalted({ chainIdOverride }: { chainIdOverride?: number } = {}) {
  return useUsdsPsmWrapperRead('HALTED', chainIdOverride);
}
