import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { createConfig, createStorage, http, noopStorage } from 'wagmi';
import { mainnet, base, sepolia, arbitrum, optimism, unichain } from 'wagmi/chains';
import {
  safeWallet,
  rainbowWallet,
  walletConnectWallet,
  metaMaskWallet,
  binanceWallet,
  coinbaseWallet
} from '@rainbow-me/rainbowkit/wallets';
import {
  TENDERLY_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  TENDERLY_RPC_URL,
  TENDERLY_BASE_RPC_URL,
  TENDERLY_ARBITRUM_RPC_URL,
  TENDERLY_ARBITRUM_CHAIN_ID
} from './testTenderlyChain';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { baseAccount } from './baseAccount';
import { Porto } from 'porto';

export const tenderly = {
  ...mainnet,
  id: TENDERLY_CHAIN_ID,
  name: 'mainnet_yusds_2025_jul_13_0',
  network: 'tenderly',
  // This is used by RainbowKit to display a chain icon for small screens
  iconUrl: 'tokens/weth.svg',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  rpcUrls: {
    public: { http: [TENDERLY_RPC_URL] },
    default: { http: [TENDERLY_RPC_URL] }
  },
  blockExplorers: {
    default: { name: '', url: '' }
  }
};

export const tenderlyBase = {
  ...base,
  id: TENDERLY_BASE_CHAIN_ID,
  name: 'new-base-testnet-jan-27',
  network: 'tenderly base',
  // This is used by RainbowKit to display a chain icon for small screens. TODO: update to Base icon once available
  iconUrl: 'tokens/weth.svg',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  rpcUrls: {
    public: { http: [TENDERLY_BASE_RPC_URL] },
    default: { http: [TENDERLY_BASE_RPC_URL] }
  },
  blockExplorers: {
    default: { name: '', url: '' }
  }
};

export const tenderlyArbitrum = {
  ...arbitrum,
  id: TENDERLY_ARBITRUM_CHAIN_ID,
  name: 'arbitrum_fork_feb_7',
  network: 'tenderly arbitrum',
  // This is used by RainbowKit to display a chain icon for small screens. TODO: update to Arbitrum icon once available
  iconUrl: 'tokens/weth.svg',
  nativeCurrency: {
    decimals: 18,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  rpcUrls: {
    public: { http: [TENDERLY_ARBITRUM_RPC_URL] },
    default: { http: [TENDERLY_ARBITRUM_RPC_URL] }
  },
  blockExplorers: {
    default: { name: '', url: '' }
  }
};

// Initialize porto connector so it can be included in the modal via EIP-6963.
Porto.create();

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Suggested',
      wallets: [
        metaMaskWallet,
        baseAccount,
        coinbaseWallet,
        walletConnectWallet,
        rainbowWallet,
        safeWallet,
        binanceWallet
      ]
    }
  ],
  {
    appName: 'sky.money',
    appIcon: 'https://app.sky.money/images/sky.svg',
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'd5c6af7c0680adbaad12f33744ee4413'
  }
);

export const wagmiConfigDev = createConfig({
  chains: [mainnet, tenderly, base, arbitrum, tenderlyBase, sepolia, tenderlyArbitrum, optimism, unichain],
  connectors,
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_RPC_PROVIDER_MAINNET || ''),
    [tenderly.id]: http(import.meta.env.VITE_RPC_PROVIDER_TENDERLY || ''),
    [base.id]: http(import.meta.env.VITE_RPC_PROVIDER_BASE || ''),
    [arbitrum.id]: http(import.meta.env.VITE_RPC_PROVIDER_ARBITRUM || ''),
    [tenderlyBase.id]: http(import.meta.env.VITE_RPC_PROVIDER_TENDERLY_BASE || ''),
    [sepolia.id]: http(import.meta.env.VITE_RPC_PROVIDER_SEPOLIA || ''),
    [tenderlyArbitrum.id]: http(import.meta.env.VITE_RPC_PROVIDER_TENDERLY_ARBITRUM || ''),
    [unichain.id]: http(import.meta.env.VITE_RPC_PROVIDER_UNICHAIN || ''),
    [optimism.id]: http(import.meta.env.VITE_RPC_PROVIDER_OPTIMISM || '')
  },
  // This was causing issues in the past when users tried to connect to the Safe connector and had the Phantom wallet installed
  // due to how Phantom handled `eth_accounts` requests, resulting in the Safe connector hanging in a reconnecting state
  multiInjectedProviderDiscovery: true,
  storage: createStorage({
    storage: typeof window !== 'undefined' && window.localStorage ? window.localStorage : noopStorage,
    key: 'wagmi-dev'
  })
});

export const wagmiConfigMainnet = createConfig({
  chains: [mainnet, base, arbitrum, optimism, unichain],
  connectors,
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_RPC_PROVIDER_MAINNET || ''),
    [base.id]: http(import.meta.env.VITE_RPC_PROVIDER_BASE || ''),
    [arbitrum.id]: http(import.meta.env.VITE_RPC_PROVIDER_ARBITRUM || ''),
    [optimism.id]: http(import.meta.env.VITE_RPC_PROVIDER_OPTIMISM || ''),
    [unichain.id]: http(import.meta.env.VITE_RPC_PROVIDER_UNICHAIN || '')
  },
  multiInjectedProviderDiscovery: true
});

export const getSupportedChainIds = (chainId: number) => {
  if (isTestnetId(chainId)) {
    return [tenderly.id, tenderlyBase.id, tenderlyArbitrum.id];
  }
  return [mainnet.id, base.id, arbitrum.id, optimism.id, unichain.id];
};

export const getMainnetChainName = (chainId: number) => {
  if (isTestnetId(chainId)) {
    return tenderly.name;
  }
  return mainnet.name;
};
