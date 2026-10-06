import { useChainId } from 'wagmi';

/** The indexer behind the app's proxy origin (`VITE_PROXY_ORIGIN`), as the module tables read it. */
export function getProxyIndexerUrl(chainId: number) {
  return `${import.meta.env.VITE_PROXY_ORIGIN || 'https://staging-proxy.sky.money'}/indexer/${chainId}`;
}

export function useIndexerUrl() {
  const chainId = useChainId();
  return getProxyIndexerUrl(chainId);
}
