import { URL_SKY_SUBGRAPH, URL_BA_LABS_API_MAINNET } from '../constants';

export function getSubgraphUrl(chainId: number): string {
  return `${URL_SKY_SUBGRAPH}/${chainId}`;
}

export function getBaLabsApiUrl(): string {
  return URL_BA_LABS_API_MAINNET;
}
