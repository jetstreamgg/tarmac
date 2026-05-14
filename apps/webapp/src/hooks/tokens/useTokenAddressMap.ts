import { useMemo } from 'react';
import { TOKENS } from '../tokens/tokens.constants';
import { useChainId } from 'wagmi';

export function useTokenAddressMap(chainIdParam?: number) {
  const currentChainId = useChainId();
  const chainId = chainIdParam || currentChainId;

  return useMemo(() => {
    if (!chainId) {
      return {};
    }

    const mapping: { [address: string]: (typeof TOKENS)[keyof typeof TOKENS] } = {};
    Object.values(TOKENS).forEach(token => {
      const address = token.address[chainId];
      if (address) {
        mapping[address.toLowerCase()] = token;
      }
    });
    return mapping;
  }, [chainId]);
}
