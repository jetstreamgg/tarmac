import { Chain, defineChain } from 'viem';
import tenderlyTestnetData from '../../../../../../tenderlyTestnetData.json' with { type: 'json' };
import tenderlyTestnetDataAlternate from '../../../../../../tenderlyTestnetData-alternate.json' with { type: 'json' };
import { arbitrum, base, mainnet, optimism, unichain } from 'viem/chains';
import { NetworkName } from '../../../test/e2e/utils/constants';

// Use alternate VNet config when VITE_USE_ALTERNATE_VNET is set
// Check both Vite env (browser) and process.env (Node.js/tests)
// Note: typeof check is required because `process` doesn't exist in browser context
const useAlternateVnet =
  import.meta.env?.VITE_USE_ALTERNATE_VNET === 'true' ||
  (typeof process !== 'undefined' && process.env?.USE_ALTERNATE_VNET === 'true');
const vnetData = useAlternateVnet ? tenderlyTestnetDataAlternate : tenderlyTestnetData;

export const TENDERLY_CHAIN_ID = 314310;

// The named testnet's path; every network's public RPC shares it under its own subdomain.
const TENDERLY_TESTNET_PATH =
  import.meta.env?.VITE_TENDERLY_TESTNET_PATH || 'jetstreamgg/jetstream/jetstream-testnet';

/** Public RPC of the named Tenderly testnet on one network, e.g. `mainnet` or `base`. */
export const tenderlyTestnetRpc = (subdomain: string) =>
  `https://virtual.${subdomain}.eu.rpc.tenderly.co/${TENDERLY_TESTNET_PATH}`;

export const TENDERLY_RPC_URL = tenderlyTestnetRpc('mainnet');

export const getTestTenderlyChains = () => {
  const mainnetData = vnetData.find(data => data.NETWORK === NetworkName.mainnet);
  const arbitrumData = vnetData.find(data => data.NETWORK === NetworkName.arbitrum);
  const baseData = vnetData.find(data => data.NETWORK === NetworkName.base);
  const optimismData = vnetData.find(data => data.NETWORK === NetworkName.optimism);
  const unichainData = vnetData.find(data => data.NETWORK === NetworkName.unichain);

  if (!mainnetData || !arbitrumData || !baseData || !optimismData || !unichainData) {
    throw new Error('Missing required network data from tenderlyTestnetData file');
  }

  return [
    defineChain({
      ...mainnet,
      id: TENDERLY_CHAIN_ID,
      name: 'Tenderly Mainnet',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: { http: [mainnetData.TENDERLY_RPC_URL || TENDERLY_RPC_URL] }
      }
    }),
    defineChain({
      ...base,
      name: 'Tenderly Base',
      rpcUrls: {
        default: { http: [baseData.TENDERLY_RPC_URL] }
      }
    }),
    defineChain({
      ...arbitrum,
      name: 'Tenderly Arbitrum',
      rpcUrls: {
        default: { http: [arbitrumData.TENDERLY_RPC_URL] }
      }
    }),
    defineChain({
      ...optimism,
      name: 'Tenderly Optimism',
      rpcUrls: {
        default: { http: [optimismData.TENDERLY_RPC_URL] }
      }
    }),
    defineChain({
      ...unichain,
      name: 'Tenderly Unichain',
      rpcUrls: {
        default: { http: [unichainData.TENDERLY_RPC_URL] }
      }
    })
  ] as readonly Chain[];
};
