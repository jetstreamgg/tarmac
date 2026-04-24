export function useSubgraphUrl() {
  return `${import.meta.env.VITE_PROXY_ORIGIN || ''}/indexer`;
}
