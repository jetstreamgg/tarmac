import { createConfig, createStorage, http, noopStorage } from 'wagmi';
import { mainnet, base, sepolia, arbitrum, optimism, unichain } from 'wagmi/chains';
import { metaMask, safe, walletConnect, coinbaseWallet, baseAccount } from 'wagmi/connectors';
import { TENDERLY_CHAIN_ID, TENDERLY_RPC_URL } from './testTenderlyChain';
import { isTestnetId } from '@jetstreamgg/sky-utils';

export const tenderly = {
  ...mainnet,
  id: TENDERLY_CHAIN_ID,
  name: 'mainnet-fork-sep-9',
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

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'd5c6af7c0680adbaad12f33744ee4413';

const connectors = [
  // Core wallets
  metaMask(),
  baseAccount({
    appName: 'sky.money',
    appLogoUrl: 'https://app.sky.money/images/sky.svg'
  }),
  coinbaseWallet({
    appName: 'sky.money',
    appLogoUrl: 'https://app.sky.money/images/sky.svg'
  }),
  walletConnect({
    projectId,
    metadata: {
      name: 'sky.money',
      description: 'Sky Protocol DeFi Application',
      url: 'https://app.sky.money',
      icons: ['https://app.sky.money/images/sky.svg']
    }
  }),
  safe()
];

export const wagmiConfigDev = createConfig({
  chains: [mainnet, tenderly, base, arbitrum, sepolia, optimism, unichain],
  connectors: connectors,
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_RPC_PROVIDER_MAINNET || ''),
    [tenderly.id]: http(import.meta.env.VITE_RPC_PROVIDER_TENDERLY || ''),
    [base.id]: http(import.meta.env.VITE_RPC_PROVIDER_BASE || ''),
    [arbitrum.id]: http(import.meta.env.VITE_RPC_PROVIDER_ARBITRUM || ''),
    [sepolia.id]: http(import.meta.env.VITE_RPC_PROVIDER_SEPOLIA || ''),
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
  connectors: connectors,
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
