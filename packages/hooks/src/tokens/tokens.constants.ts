import { base, mainnet, arbitrum, optimism, unichain } from 'wagmi/chains';
import {
  mcdDaiConfig,
  skyConfig,
  usdsConfig,
  mkrConfig,
  wethConfig,
  usdcConfig,
  usdtConfig,
  lsMkrConfig,
  sUsdsConfig,
  sUsdsL2Address,
  usdcL2Address,
  usdsL2Address,
  stUsdsAddress,
  spkConfig
} from '../generated';
import { TokenMapping, Token, TokenForChain } from './types';
import { TENDERLY_CHAIN_ID } from '../constants';

export function getTokenDecimals(
  token: Token | TokenForChain | undefined | null,
  chainId: number,
  defaultDecimals = 18
): number {
  if (!token) {
    return defaultDecimals;
  }
  if (typeof token.decimals === 'number') {
    return token.decimals;
  }
  return token.decimals[chainId] ?? defaultDecimals; // fallback to 18 if not specified
}

export function tokenArrayFiltered(arr: Array<TokenForChain>, elementToRemove?: TokenForChain) {
  return arr?.filter(el => el !== elementToRemove);
}

export function tokenForChainToToken(
  tokenForChain: TokenForChain,
  address: `0x${string}`,
  chainId: number
): Token {
  return { ...tokenForChain, address: { [chainId]: address } };
}

export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const;

export const TOKENS: TokenMapping = {
  eth: {
    address: {
      [mainnet.id]: ETH_ADDRESS,
      [TENDERLY_CHAIN_ID]: ETH_ADDRESS,
      [base.id]: ETH_ADDRESS,
      [arbitrum.id]: ETH_ADDRESS,
      [optimism.id]: ETH_ADDRESS,
      [unichain.id]: ETH_ADDRESS
    },
    name: 'Ether',
    symbol: 'ETH',
    color: '#6d7ce3',
    isNative: true,
    decimals: 18
  },
  dai: {
    address: mcdDaiConfig.address,
    name: 'DAI',
    symbol: 'DAI',
    color: '#fbc854',
    decimals: 18
  },
  mkr: {
    address: mkrConfig.address,
    name: 'MKR',
    symbol: 'MKR',
    color: '#1aab9b',
    decimals: 18
  },
  sky: {
    address: {
      ...skyConfig.address
    },
    name: 'SKY',
    symbol: 'SKY',
    color: '#d56ed7',
    decimals: 18
  },
  usds: {
    address: {
      ...usdsConfig.address,
      [base.id]: usdsL2Address[base.id],
      [arbitrum.id]: usdsL2Address[arbitrum.id],
      [optimism.id]: usdsL2Address[optimism.id],
      [unichain.id]: usdsL2Address[unichain.id]
    },
    name: 'USDS',
    symbol: 'USDS',
    color: '#ffa74e',
    decimals: 18
  },
  weth: {
    address: wethConfig.address,
    name: 'WETH',
    symbol: 'WETH',
    color: '#6d7ce3',
    decimals: 18,
    // do not delete this property, it is used to determine price of ETH for native ETH trades
    isWrappedNative: true
  },
  usdc: {
    address: {
      ...usdcConfig.address,
      [base.id]: usdcL2Address[base.id],
      [arbitrum.id]: usdcL2Address[arbitrum.id],
      [optimism.id]: usdcL2Address[optimism.id],
      [unichain.id]: usdcL2Address[unichain.id]
    },
    name: 'USDC',
    symbol: 'USDC',
    color: '#4872c4',
    decimals: {
      [mainnet.id]: 6,
      [base.id]: 6,
      [arbitrum.id]: 6,
      [TENDERLY_CHAIN_ID]: 6,
      [optimism.id]: 6,
      [unichain.id]: 6
    }
  },
  usdt: {
    address: usdtConfig.address,
    name: 'USDT',
    symbol: 'USDT',
    color: '#5a9e7d',
    decimals: 6
  },
  lsmkr: {
    address: lsMkrConfig.address,
    name: 'LSMKR',
    symbol: 'LSMKR',
    color: '#1AAB9B',
    decimals: 18
  },
  // TODO: update address, color, decimals data when we get real data
  cle: {
    address: skyConfig.address,
    name: 'CLE',
    symbol: 'CLE',
    color: '#9CD33B',
    decimals: 18
  },
  susds: {
    address: {
      ...sUsdsConfig.address,
      [base.id]: sUsdsL2Address[base.id],
      [arbitrum.id]: sUsdsL2Address[arbitrum.id],
      [optimism.id]: sUsdsL2Address[optimism.id],
      [unichain.id]: sUsdsL2Address[unichain.id]
    },
    name: 'sUSDS',
    symbol: 'sUSDS',
    color: '#1AAB9B',
    decimals: 18
  },
  spk: {
    address: spkConfig.address,
    name: 'Spark',
    symbol: 'SPK',
    color: '#FA5768',
    decimals: 18
  },
  stusds: {
    address: stUsdsAddress, // TODO: no stUsdsConfig for now as it comes from the wagmi etherscan plugin
    name: 'stUSDS',
    symbol: 'stUSDS',
    color: '#EB5EDF',
    decimals: 18
  }
};

export function getTokensForChain(chainId: number): TokenForChain[] {
  const tokensForChain: TokenForChain[] = [];

  for (const token of Object.values(TOKENS)) {
    const address = token.address[chainId];
    if (address) {
      tokensForChain.push({
        ...token,
        address
      });
    }
  }

  return tokensForChain;
}
