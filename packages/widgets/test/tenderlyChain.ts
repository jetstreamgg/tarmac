import { Chain, defineChain } from 'viem';
import { readFileSync } from 'fs';
import {
  TENDERLY_ARBITRUM_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  TENDERLY_CHAIN_ID
} from '../src/shared/constants';
import { optimism, unichain } from 'viem/chains';

export const getTenderlyChains = () => {
  const res = readFileSync('../../tenderlyTestnetData.json', 'utf-8');
  const [mainnetData, baseData, arbitrumData, optimismData, unichainData] = JSON.parse(res);

  return [
    defineChain({
      id: TENDERLY_CHAIN_ID,
      name: 'Tenderly Mainnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [mainnetData.TENDERLY_RPC_URL] }
      }
    }),
    defineChain({
      id: TENDERLY_BASE_CHAIN_ID,
      name: 'Tenderly Base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [baseData.TENDERLY_RPC_URL] }
      }
    }),
    defineChain({
      id: TENDERLY_ARBITRUM_CHAIN_ID,
      name: 'Tenderly Arbitrum',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [arbitrumData.TENDERLY_RPC_URL] }
      }
    }),
    {
      ...optimism,
      name: 'Tenderly Optimism',
      rpcUrls: {
        default: { http: [optimismData.TENDERLY_RPC_URL] }
      }
    },
    {
      ...unichain,
      name: 'Tenderly Unichain',
      rpcUrls: {
        default: { http: [unichainData.TENDERLY_RPC_URL] }
      }
    }
  ] as readonly Chain[];
};
