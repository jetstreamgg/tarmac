import { base, mainnet, sepolia } from 'wagmi/chains';
import {
  mcdDaiConfig,
  skyConfig,
  usdsConfig,
  mkrConfig,
  wethConfig,
  usdcConfig,
  usdtConfig,
  lsMkrConfig,
  wethSepoliaAddress,
  mcdDaiSepoliaAddress,
  usdcSepoliaAddress,
  usdtSepoliaAddress,
  sUsdsConfig,
  skyBaseAddress,
  sUsdsBaseAddress,
  usdcBaseAddress,
  usdsBaseAddress
} from '../generated';
import { TokenMapping, Token, TokenForChain } from './types';
import { TENDERLY_BASE_CHAIN_ID, TENDERLY_CHAIN_ID } from '../constants';

export function getTokenDecimals(token: Token | TokenForChain, chainId: number): number {
  if (typeof token.decimals === 'number') {
    return token.decimals;
  }
  return token.decimals[chainId] ?? 18; // fallback to 18 if not specified
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
      [TENDERLY_BASE_CHAIN_ID]: ETH_ADDRESS
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
      ...skyConfig.address,
      [base.id]: skyBaseAddress[base.id],
      [TENDERLY_BASE_CHAIN_ID]: skyBaseAddress[base.id]
    },
    name: 'SKY',
    symbol: 'SKY',
    color: '#d56ed7',
    decimals: 18
  },
  usds: {
    address: {
      ...usdsConfig.address,
      [base.id]: usdsBaseAddress[base.id],
      [TENDERLY_BASE_CHAIN_ID]: usdsBaseAddress[base.id]
    },
    name: 'USDS',
    symbol: 'USDS',
    color: '#b66bfc',
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
      [base.id]: usdcBaseAddress[base.id],
      [TENDERLY_BASE_CHAIN_ID]: usdcBaseAddress[base.id]
    },
    name: 'USDC',
    symbol: 'USDC',
    color: '#4872c4',
    decimals: {
      [mainnet.id]: 6,
      [base.id]: 6,
      [sepolia.id]: 18,
      [TENDERLY_CHAIN_ID]: 6,
      [TENDERLY_BASE_CHAIN_ID]: 6
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
      [base.id]: sUsdsBaseAddress[base.id],
      [TENDERLY_BASE_CHAIN_ID]: sUsdsBaseAddress[base.id]
    },
    name: 'sUSDS',
    symbol: 'sUSDS',
    color: '#1AAB9B',
    decimals: 18
  }
};

export const TRADE_TOKENS = {
  [mainnet.id]: {
    usdc: { ...TOKENS.usdc, address: usdcConfig.address[mainnet.id] },
    usdt: { ...TOKENS.usdt, address: usdtConfig.address[mainnet.id] },
    eth: { ...TOKENS.eth, address: TOKENS.eth.address[mainnet.id] },
    weth: { ...TOKENS.weth, address: wethConfig.address[mainnet.id] },
    dai: { ...TOKENS.dai, address: mcdDaiConfig.address[mainnet.id] },
    mkr: { ...TOKENS.mkr, address: mkrConfig.address[mainnet.id] },
    usds: { ...TOKENS.usds, address: usdsConfig.address[mainnet.id] },
    sky: { ...TOKENS.sky, address: skyConfig.address[mainnet.id] },
    susds: { ...TOKENS.susds, address: sUsdsConfig.address[mainnet.id] }
  },
  [sepolia.id]: {
    usdc: { ...TOKENS.usdc, address: usdcSepoliaAddress[sepolia.id] },
    usdt: { ...TOKENS.usdt, address: usdtSepoliaAddress[sepolia.id] },
    eth: { ...TOKENS.eth, address: ETH_ADDRESS },
    weth: { ...TOKENS.weth, address: wethSepoliaAddress[sepolia.id] },
    dai: { ...TOKENS.dai, address: mcdDaiSepoliaAddress[sepolia.id] }
  },
  [TENDERLY_CHAIN_ID]: {
    usdc: { ...TOKENS.usdc, address: usdcConfig.address[TENDERLY_CHAIN_ID] },
    usdt: { ...TOKENS.usdt, address: usdtConfig.address[TENDERLY_CHAIN_ID] },
    eth: { ...TOKENS.eth, address: TOKENS.eth.address[TENDERLY_CHAIN_ID] },
    weth: { ...TOKENS.weth, address: wethConfig.address[TENDERLY_CHAIN_ID] },
    dai: { ...TOKENS.dai, address: mcdDaiConfig.address[TENDERLY_CHAIN_ID] },
    mkr: { ...TOKENS.mkr, address: mkrConfig.address[TENDERLY_CHAIN_ID] },
    usds: { ...TOKENS.usds, address: usdsConfig.address[TENDERLY_CHAIN_ID] },
    sky: { ...TOKENS.sky, address: skyConfig.address[TENDERLY_CHAIN_ID] },
    susds: { ...TOKENS.susds, address: sUsdsConfig.address[TENDERLY_CHAIN_ID] }
  },
  [base.id]: {
    usdc: { ...TOKENS.usdc, address: usdcBaseAddress[base.id] },
    usds: { ...TOKENS.usds, address: usdsBaseAddress[base.id] },
    susds: { ...TOKENS.susds, address: sUsdsBaseAddress[base.id] }
  }
  // TODO add tenderly base tokens once forked with PSM3
  // [TENDERLY_BASE_CHAIN_ID]: {
  //   usdc: { ...TOKENS.usdc, address: usdcBaseAddress[TENDERLY_BASE_CHAIN_ID] },
  //   usds: { ...TOKENS.usds, address: usdsBaseAddress[TENDERLY_BASE_CHAIN_ID] },
  //   susds: { ...TOKENS.susds, address: sUsdsBaseAddress[TENDERLY_BASE_CHAIN_ID] },
  // }
};
