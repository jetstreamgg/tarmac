import {
  STAGING_URL_SKY_SUBGRAPH_MAINNET,
  PROD_URL_SKY_SUBGRAPH_MAINNET,
  STAGING_URL_SKY_SUBGRAPH_TESTNET,
  STAGING_URL_SKY_SUBGRAPH_BASE,
  PROD_URL_SKY_SUBGRAPH_BASE,
  PROD_URL_SKY_SUBGRAPH_ARBITRUM,
  STAGING_URL_SKY_SUBGRAPH_ARBITRUM,
  PROD_URL_SKY_SUBGRAPH_UNICHAIN,
  PROD_URL_SKY_SUBGRAPH_OPTIMISM,
  STAGING_URL_SKY_SUBGRAPH_OPTIMISM,
  STAGING_URL_SKY_SUBGRAPH_UNICHAIN,
  IS_STAGING_ENV,
  IS_DEVELOPMENT_ENV
} from '@/lib/constants';
import { useMemo } from 'react';
import { useChainId } from 'wagmi';
import { mainnet, base, arbitrum, unichain, optimism } from 'viem/chains';
import { tenderly } from '@/data/wagmi/config/config.default';

function getSubgraphUrl(chainId: number): string {
  if (IS_STAGING_ENV || IS_DEVELOPMENT_ENV) {
    switch (chainId) {
      case mainnet.id:
        return STAGING_URL_SKY_SUBGRAPH_MAINNET;
      case base.id:
        return STAGING_URL_SKY_SUBGRAPH_BASE;
      case arbitrum.id:
        return STAGING_URL_SKY_SUBGRAPH_ARBITRUM;
      case optimism.id:
        return STAGING_URL_SKY_SUBGRAPH_OPTIMISM;
      case unichain.id:
        return STAGING_URL_SKY_SUBGRAPH_UNICHAIN;
      case tenderly.id:
        return STAGING_URL_SKY_SUBGRAPH_TESTNET;
      default:
        return PROD_URL_SKY_SUBGRAPH_MAINNET;
    }
  } else {
    switch (chainId) {
      case mainnet.id:
        return PROD_URL_SKY_SUBGRAPH_MAINNET;
      case base.id:
        return PROD_URL_SKY_SUBGRAPH_BASE;
      case arbitrum.id:
        return PROD_URL_SKY_SUBGRAPH_ARBITRUM;
      case optimism.id:
        return PROD_URL_SKY_SUBGRAPH_OPTIMISM;
      case unichain.id:
        return PROD_URL_SKY_SUBGRAPH_UNICHAIN;
      default:
        return '';
    }
  }
}

export function useSubgraphUrl(overrideChainId?: number) {
  const connectedChainId = useChainId();
  const chainId = overrideChainId ?? connectedChainId;

  return useMemo(() => getSubgraphUrl(chainId), [chainId]);
}
