import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { createConfig, http } from 'wagmi';
import { mainnet, base, sepolia } from 'wagmi/chains';
import {
  safeWallet,
  rainbowWallet,
  walletConnectWallet,
  metaMaskWallet,
  coinbaseWallet,
  injectedWallet
} from '@rainbow-me/rainbowkit/wallets';
import {
  TENDERLY_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  TENDERLY_RPC_URL,
  TENDERLY_BASE_RPC_URL
} from './testTenderlyChain';
import { isTestnetId } from '@jetstreamgg/utils';

export const tenderly = {
  id: TENDERLY_CHAIN_ID,
  name: 'mainnet_sep_30_0',
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

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Suggested',
      wallets: [
        metaMaskWallet,
        coinbaseWallet,
        walletConnectWallet,
        rainbowWallet,
        safeWallet,
        injectedWallet
      ]
    }
  ],
  {
    appName: 'sky.money',
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'd5c6af7c0680adbaad12f33744ee4413'
  }
);

export const wagmiConfigDev = createConfig({
  chains: [mainnet, tenderly, base, tenderlyBase, sepolia],
  connectors,
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_RPC_PROVIDER_MAINNET || ''),
    [tenderly.id]: http(import.meta.env.VITE_RPC_PROVIDER_TENDERLY || ''),
    [base.id]: http(import.meta.env.VITE_RPC_PROVIDER_BASE || ''),
    [tenderlyBase.id]: http(import.meta.env.VITE_RPC_PROVIDER_TENDERLY_BASE || ''),
    [sepolia.id]: http(import.meta.env.VITE_RPC_PROVIDER_SEPOLIA || '')
  },
  multiInjectedProviderDiscovery: false
});

export const wagmiConfigMainnet = createConfig({
  chains: [mainnet, base],
  connectors,
  transports: {
    [mainnet.id]: http(import.meta.env.VITE_RPC_PROVIDER_MAINNET || ''),
    [base.id]: http(import.meta.env.VITE_RPC_PROVIDER_BASE || '')
  },
  multiInjectedProviderDiscovery: false
});

//TODO: add arbitrum
export const getSupportedChainIds = (chainId: number) => {
  if (isTestnetId(chainId)) {
    return [tenderly.id, tenderlyBase.id];
  }
  return [mainnet.id, base.id];
};

export const getMainnetChainName = (chainId: number) => {
  if (isTestnetId(chainId)) {
    return tenderly.name;
  }
  return mainnet.name;
};
