import { useChainId } from 'wagmi';

export function useSubgraphUrl() {
  const chainId = useChainId();
  return `${import.meta.env.VITE_PROXY_ORIGIN || 'https://staging-proxy.sky.money'}/indexer/${chainId}`;
}
