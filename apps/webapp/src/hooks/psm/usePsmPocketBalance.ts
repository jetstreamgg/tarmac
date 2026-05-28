import { useChainId } from 'wagmi';
import { useTokenBalance } from '../tokens/useTokenBalance';
import { usdcAddress } from '../generated';
import { psmPocketAddress } from './usdsPsmWrapper';

export function usePsmPocketBalance({ chainIdOverride }: { chainIdOverride?: number } = {}) {
  const chainId = useChainId();
  const effectiveChainId = chainIdOverride ?? chainId;
  const pocket = psmPocketAddress[effectiveChainId as keyof typeof psmPocketAddress];
  const token = usdcAddress[effectiveChainId as keyof typeof usdcAddress];

  return useTokenBalance({
    address: pocket,
    token,
    chainId: effectiveChainId,
    enabled: Boolean(pocket && token)
  });
}
