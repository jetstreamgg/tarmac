import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { createConfig, http, type Config } from 'wagmi';
import { mainnet, sepolia, base, arbitrum } from 'wagmi/chains';

export const TENDERLY_CHAIN_ID = 314310;
export const TENDERLY_BASE_CHAIN_ID = 8555;
export const TENDERLY_ARBITRUM_CHAIN_ID = 42012;

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
  name: 'base_oct_9_0',
  network: 'tenderly base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  rpcUrls: {
    public: { http: [import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY_BASE || ''] },
    default: { http: [import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY_BASE || ''] }
  },
  blockExplorers: {
    default: { name: '', url: '' }
  }
};

export const tenderlyArbitrum = {
  id: TENDERLY_ARBITRUM_CHAIN_ID,
  name: 'arbitrum_fork_feb_7',
  network: 'tenderly arbitrum',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  rpcUrls: {
    public: { http: [import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY_ARBITRUM || ''] },
    default: { http: [import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY_ARBITRUM || ''] }
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
    chains: [tenderly, mainnet, sepolia, base, arbitrum, tenderlyBase, tenderlyArbitrum],
    connectors,
    transports: {
      [tenderly.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY || ''),
      [mainnet.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_MAINNET || ''),
      [sepolia.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_SEPOLIA || ''),
      [base.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_BASE || ''),
      [arbitrum.id]: http(
        import.meta.env.VITE_PUBLIC_RPC_PROVIDER_ARBITRUM ||
          'https://arbitrum.gateway.tenderly.co/6BRHNNW1ioY5id9p8ltKS7'
      ),
      [tenderlyBase.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY_BASE || ''),
      [tenderlyArbitrum.id]: http(import.meta.env.VITE_PUBLIC_RPC_PROVIDER_TENDERLY_ARBITRUM || '')
    },
    multiInjectedProviderDiscovery: false
  });

  return wagmiConfig;
};
