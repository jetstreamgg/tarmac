import { Chain, defineChain } from 'viem';
import { TENDERLY_ARBITRUM_CHAIN_ID, TENDERLY_BASE_CHAIN_ID, TENDERLY_CHAIN_ID } from '../src/constants';
import { readFileSync } from 'fs';
import { optimism, unichain } from 'viem/chains';
import { NetworkName } from './constants';

export const getTenderlyChains = () => {
  const res = readFileSync('../../tenderlyTestnetData.json', 'utf-8');
  const tenderlyTestnetData = JSON.parse(res);

  const mainnetData = tenderlyTestnetData.find((data: any) => data.NETWORK === NetworkName.mainnet);
  const baseData = tenderlyTestnetData.find((data: any) => data.NETWORK === NetworkName.base);
  const arbitrumData = tenderlyTestnetData.find((data: any) => data.NETWORK === NetworkName.arbitrum);
  const optimismData = tenderlyTestnetData.find((data: any) => data.NETWORK === NetworkName.optimism);
  const unichainData = tenderlyTestnetData.find((data: any) => data.NETWORK === NetworkName.unichain);

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
