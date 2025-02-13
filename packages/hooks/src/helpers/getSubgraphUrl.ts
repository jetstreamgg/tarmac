import { sepolia } from 'wagmi/chains';
import {
  URL_MAKER_SUBGRAPH_MAINNET,
  URL_MAKER_SUBGRAPH_TENDERLY,
  TENDERLY_CHAIN_ID,
  URL_BA_LABS_API_TENDERLY,
  URL_BA_LABS_API_MAINNET,
  URL_BASE_SUBGRAPH_MAINNET,
  URL_BASE_SUBGRAPH_TENDERLY,
  BASE_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  ARBITRUM_CHAIN_ID,
  URL_ARBITRUM_SUBGRAPH_MAINNET,
  TENDERLY_ARBITRUM_CHAIN_ID,
  URL_ARBITRUM_SUBGRAPH_TENDERLY
} from '../constants';

const defaultSubgraphUrl = URL_MAKER_SUBGRAPH_MAINNET;
const defaultBaseSubgraphUrl = URL_BASE_SUBGRAPH_MAINNET;

export function getMakerSubgraphUrl(chainId: number): string | null {
  switch (chainId) {
    case 1:
      return URL_MAKER_SUBGRAPH_MAINNET;
    case TENDERLY_CHAIN_ID:
      return URL_MAKER_SUBGRAPH_TENDERLY;
    default:
      return defaultSubgraphUrl;
  }
}

export function getL2SubgraphUrl(chainId: number): string | null {
  switch (chainId) {
    case 1:
    case BASE_CHAIN_ID:
      return URL_BASE_SUBGRAPH_MAINNET;
    case TENDERLY_CHAIN_ID:
    case TENDERLY_BASE_CHAIN_ID:
      return URL_BASE_SUBGRAPH_TENDERLY;
    case ARBITRUM_CHAIN_ID:
      return URL_ARBITRUM_SUBGRAPH_MAINNET;
    case TENDERLY_ARBITRUM_CHAIN_ID:
      return URL_ARBITRUM_SUBGRAPH_TENDERLY;
    default:
      return defaultBaseSubgraphUrl;
  }
}

export function getBaLabsApiUrl(chainId: number): string | null {
  switch (chainId) {
    case sepolia.id:
    case TENDERLY_CHAIN_ID:
      return URL_BA_LABS_API_TENDERLY;
    default:
      return URL_BA_LABS_API_MAINNET;
  }
}
