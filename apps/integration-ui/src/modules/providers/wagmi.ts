import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { createConfig, http, type Config } from 'wagmi';
import { mainnet, sepolia, base } from 'wagmi/chains';

export const TENDERLY_CHAIN_ID = 314310;
export const TENDERLY_BASE_CHAIN_ID = 8555;

export const tenderly = {
  id: TENDERLY_CHAIN_ID,
  name: 'Tenderly Testnet',
  network: 'tenderly',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  rpcUrls: {
    public: { http: ['https://virtual.mainnet.rpc.tenderly.co/b333d3ac-c24f-41fa-ad41-9176fa719ac3'] },
    default: { http: ['https://virtual.mainnet.rpc.tenderly.co/b333d3ac-c24f-41fa-ad41-9176fa719ac3'] }
  },
  blockExplorers: {
    default: { name: '', url: '' }
  }
};

export const tenderlyBase = {
  id: TENDERLY_BASE_CHAIN_ID,
  name: 'new-base-testnet-jan-27',
  network: 'tenderly base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  rpcUrls: {
    public: { http: ['https://virtual.base.rpc.tenderly.co/013be623-d567-4b28-86f6-834d6cfb3e6c'] },
    default: { http: ['https://virtual.base.rpc.tenderly.co/013be623-d567-4b28-86f6-834d6cfb3e6c'] }
  },
  blockExplorers: {
    default: { name: '', url: '' }
  }
};
export const getWagmiClientAndChains = (appName: string): Config => {
  const { connectors } = getDefaultWallets({
    appName,
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'd5c6af7c0680adbaad12f33744ee4413'
  });

  const wagmiConfig = createConfig({
    chains: [tenderly, mainnet, sepolia, base, tenderlyBase],
    connectors,
    transports: {
      [tenderly.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY || ''),
      [mainnet.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_MAINNET || ''),
      [sepolia.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_SEPOLIA || ''),
      [base.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_BASE || ''),
      [tenderlyBase.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY_BASE || '')
    },
    multiInjectedProviderDiscovery: false
  });

  return wagmiConfig;
};
