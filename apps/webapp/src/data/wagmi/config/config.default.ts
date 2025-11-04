import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { createConfig, createStorage, http, noopStorage } from 'wagmi';
import { mainnet, base, arbitrum, optimism, unichain } from 'wagmi/chains';
import {
  safeWallet,
  rainbowWallet,
  walletConnectWallet,
  metaMaskWallet,
  binanceWallet,
  coinbaseWallet
} from '@rainbow-me/rainbowkit/wallets';
import { TENDERLY_CHAIN_ID, TENDERLY_RPC_URL } from './testTenderlyChain';
import { isTestnetId } from '@jetstreamgg/sky-utils';
import { baseAccount } from './baseAccount';

export const tenderly = {
  ...mainnet,
  id: TENDERLY_CHAIN_ID,
  name: 'Tenderly',
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
  chains: [mainnet, tenderly, base, arbitrum, optimism, unichain],
  connectors,
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_RPC_PROVIDER_MAINNET || ''),
    [tenderly.id]: http(import.meta.env.VITE_RPC_PROVIDER_TENDERLY || ''),
    [base.id]: http(import.meta.env.VITE_RPC_PROVIDER_BASE || ''),
    [arbitrum.id]: http(import.meta.env.VITE_RPC_PROVIDER_ARBITRUM || ''),
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
    return [tenderly.id];
  }
  return [mainnet.id, base.id, arbitrum.id, optimism.id, unichain.id];
};

export const getMainnetChainName = (chainId: number) => {
  if (isTestnetId(chainId)) {
    return tenderly.name;
  }
  return mainnet.name;
};
