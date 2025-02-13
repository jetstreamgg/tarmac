import { Chain, defineChain } from 'viem';
import tenderlyTestnetData from '../../../../../../tenderlyTestnetData.json' with { type: 'json' };

export const TENDERLY_CHAIN_ID = 314310;
export const TENDERLY_BASE_CHAIN_ID = 8555;
export const TENDERLY_ARBITRUM_CHAIN_ID = 42012;

// only works if hardcoded, cannot be set via env variable. Corresponds to the public RPC of `mainnet_sep_30_0`
export const TENDERLY_RPC_URL =
  'https://virtual.mainnet.rpc.tenderly.co/b333d3ac-c24f-41fa-ad41-9176fa719ac3';

// only works if hardcoded, cannot be set via env variable. Corresponds to the public RPC of `base_oct_9_0`
export const TENDERLY_BASE_RPC_URL =
  'https://virtual.base.rpc.tenderly.co/376e4980-c2de-48b9-bf76-c25bd6d1c324';

// only works if hardcoded, cannot be set via env variable. Corresponds to the public RPC of `Arbitrum-fork-feb-7`
export const TENDERLY_ARBITRUM_RPC_URL =
  'https://virtual.arbitrum.rpc.tenderly.co/5a2a28a6-322f-4506-acf8-1151a13b5ccf';

export const getTestTenderlyChains = () => {
  const [mainnetData, baseData, arbitrumData] = tenderlyTestnetData;

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
    })
  ] as readonly [Chain, Chain, Chain];
};
