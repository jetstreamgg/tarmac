import { URL_SKY_INDEXER, URL_BA_LABS_API_MAINNET } from '../constants';

export function getIndexerUrl(chainId: number): string {
  return `${URL_SKY_INDEXER}/${chainId}`;
}

export function getBaLabsApiUrl(): string {
  return URL_BA_LABS_API_MAINNET;
}
