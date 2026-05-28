import { useChainId } from 'wagmi';
import { TOKENS } from './tokens.constants';
import { TokenForChain } from './types';
import { ZERO_ADDRESS } from '../constants';

// Returns tokens that are supported by the current chain
// Eth token has no address
export function useTokens(chainId?: number): TokenForChain[] {
  const currentChainId = chainId ? chainId : useChainId();

  const tokens = Object.values(TOKENS).filter(t => t.address[currentChainId] !== undefined);
  return tokens.map(t => ({
    ...t,
    address: t.address[currentChainId] === ZERO_ADDRESS ? undefined : t.address[currentChainId] || undefined
  }));
}
