import { Chain, defineChain } from 'viem';
import { TENDERLY_ARBITRUM_CHAIN_ID, TENDERLY_BASE_CHAIN_ID, TENDERLY_CHAIN_ID } from '../src/constants';
import { readFileSync } from 'fs';

export const getTenderlyChains = () => {
  const res = readFileSync('../../tenderlyTestnetData.json', 'utf-8');
  const [mainnetData, baseData, arbitrumData] = JSON.parse(res);

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
    })
  ] as readonly [Chain, Chain, Chain];
};
