import { Chain, defineChain } from 'viem';
import tenderlyTestnetData from '../../../../../../tenderlyTestnetData.json' with { type: 'json' };
import { optimism, unichain } from 'viem/chains';

export const TENDERLY_CHAIN_ID = 314310;
export const TENDERLY_BASE_CHAIN_ID = 8555;
export const TENDERLY_ARBITRUM_CHAIN_ID = 42012;

// only works if hardcoded, cannot be set via env variable. Corresponds to the public RPC of `mainnet_2025_apr_15_0`
export const TENDERLY_RPC_URL =
  'https://virtual.mainnet.rpc.tenderly.co/b0298788-ff98-44df-ad8a-c10b7d8e3199';

// only works if hardcoded, cannot be set via env variable. Corresponds to the public RPC of `new-base-testnet-jan-27`
export const TENDERLY_BASE_RPC_URL =
  'https://virtual.base.rpc.tenderly.co/013be623-d567-4b28-86f6-834d6cfb3e6c';

// only works if hardcoded, cannot be set via env variable. Corresponds to the public RPC of `Arbitrum-fork-feb-7`
export const TENDERLY_ARBITRUM_RPC_URL =
  'https://virtual.arbitrum.rpc.tenderly.co/5a2a28a6-322f-4506-acf8-1151a13b5ccf';

export const getTestTenderlyChains = () => {
  const [mainnetData, baseData, arbitrumData, optimismData, unichainData] = tenderlyTestnetData;

  return [
    defineChain({
      id: TENDERLY_CHAIN_ID,
      name: 'Tenderly Mainnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [mainnetData.TENDERLY_RPC_URL || TENDERLY_RPC_URL] }
      }
    }),
    defineChain({
      id: TENDERLY_BASE_CHAIN_ID,
      name: 'Tenderly Base',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [baseData.TENDERLY_RPC_URL || TENDERLY_BASE_RPC_URL] }
      }
    }),
    defineChain({
      id: TENDERLY_ARBITRUM_CHAIN_ID,
      name: 'Tenderly Arbitrum',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [arbitrumData.TENDERLY_RPC_URL || TENDERLY_ARBITRUM_RPC_URL] }
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
