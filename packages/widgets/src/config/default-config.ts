// Default configuration used site-wide

import { base, mainnet, arbitrum, unichain, optimism } from 'wagmi/chains';
import { WidgetsConfig } from './types/widgets-config';
import {
  usdsAddress,
  mcdDaiAddress,
  wethAddress,
  usdcAddress,
  usdtAddress,
  mkrAddress,
  skyAddress,
  TOKENS,
  sUsdsAddress,
  usdcL2Address,
  usdsL2Address,
  sUsdsL2Address,
  spkAddress,
  stUsdsAddress
} from '@jetstreamgg/sky-hooks';
import { TENDERLY_CHAIN_ID } from '@widgets/shared/constants';
import { SUPPORTED_TOKEN_SYMBOLS } from '..';

const { usds, mkr, sky, susds, eth, weth, usdc, usdt, dai, spk, stusds } = TOKENS;

// It stores all the RPCs the application will use, and also the user configured-ones
export const defaultConfig: WidgetsConfig = {
  balancesTokenList: {
    [mainnet.id]: [
      eth,
      { ...weth, address: wethAddress[mainnet.id] },
      { ...usdc, address: usdcAddress[mainnet.id] },
      { ...usdt, address: usdtAddress[mainnet.id] },
      { ...dai, address: mcdDaiAddress[mainnet.id] },
      { ...usds, address: usdsAddress[mainnet.id] },
      { ...susds, address: sUsdsAddress[mainnet.id] },
      { ...mkr, address: mkrAddress[mainnet.id] },
      { ...sky, address: skyAddress[mainnet.id] },
      { ...spk, address: spkAddress[mainnet.id] },
      { ...stusds, address: stUsdsAddress[mainnet.id] }
    ],
    [TENDERLY_CHAIN_ID]: [
      eth,
      { ...weth, address: wethAddress[TENDERLY_CHAIN_ID] },
      { ...usdc, address: usdcAddress[TENDERLY_CHAIN_ID] },
      { ...usdt, address: usdtAddress[TENDERLY_CHAIN_ID] },
      { ...dai, address: mcdDaiAddress[TENDERLY_CHAIN_ID] },
      { ...usds, address: usdsAddress[TENDERLY_CHAIN_ID] },
      { ...susds, address: sUsdsAddress[TENDERLY_CHAIN_ID] },
      { ...mkr, address: mkrAddress[TENDERLY_CHAIN_ID] },
      { ...sky, address: skyAddress[TENDERLY_CHAIN_ID] },
      { ...spk, address: spkAddress[TENDERLY_CHAIN_ID] },
      { ...stusds, address: stUsdsAddress[TENDERLY_CHAIN_ID] }
    ],
    [base.id]: [
      eth,
      { ...usdc, address: usdcL2Address[base.id] },
      { ...usdt, address: usdtAddress[base.id] },
      { ...weth, address: wethAddress[base.id] },
      { ...dai, address: mcdDaiAddress[base.id] },
      { ...usds, address: usdsL2Address[base.id] },
      { ...susds, address: sUsdsL2Address[base.id] }
    ],
    [arbitrum.id]: [
      eth,
      { ...usdc, address: usdcL2Address[arbitrum.id] },
      { ...usdt, address: usdtAddress[arbitrum.id] },
      { ...weth, address: wethAddress[arbitrum.id] },
      { ...dai, address: mcdDaiAddress[arbitrum.id] },
      { ...usds, address: usdsL2Address[arbitrum.id] },
      { ...susds, address: sUsdsL2Address[arbitrum.id] }
    ],
    [unichain.id]: [
      eth,
      { ...usdc, address: usdcL2Address[unichain.id] },
      { ...usds, address: usdsL2Address[unichain.id] },
      { ...susds, address: sUsdsL2Address[unichain.id] }
    ],
    [optimism.id]: [
      eth,
      { ...usdc, address: usdcL2Address[optimism.id] },
      { ...usds, address: usdsL2Address[optimism.id] },
      { ...susds, address: sUsdsL2Address[optimism.id] }
    ]
  },
  tradeTokenList: {
    [mainnet.id]: [
      { ...usdc, address: usdcAddress[mainnet.id] },
      { ...usdt, address: usdtAddress[mainnet.id] },
      { ...eth, address: eth.address[mainnet.id] },
      { ...weth, address: wethAddress[mainnet.id] },
      { ...dai, address: mcdDaiAddress[mainnet.id] },
      { ...mkr, address: mkrAddress[mainnet.id] },
      { ...usds, address: usdsAddress[mainnet.id] },
      { ...susds, address: sUsdsAddress[mainnet.id] },
      { ...sky, address: skyAddress[mainnet.id] },
      { ...spk, address: spkAddress[mainnet.id] }
    ],
    [TENDERLY_CHAIN_ID]: [
      { ...usdc, address: usdcAddress[TENDERLY_CHAIN_ID] },
      { ...usdt, address: usdtAddress[TENDERLY_CHAIN_ID] },
      { ...eth, address: eth.address[TENDERLY_CHAIN_ID] },
      { ...weth, address: wethAddress[TENDERLY_CHAIN_ID] },
      { ...dai, address: mcdDaiAddress[TENDERLY_CHAIN_ID] },
      { ...mkr, address: mkrAddress[TENDERLY_CHAIN_ID] },
      { ...usds, address: usdsAddress[TENDERLY_CHAIN_ID] },
      { ...susds, address: sUsdsAddress[TENDERLY_CHAIN_ID] },
      { ...sky, address: skyAddress[TENDERLY_CHAIN_ID] }
    ],
    [base.id]: [
      { ...usdc, address: usdcL2Address[base.id] },
      { ...usdt, address: usdtAddress[base.id] },
      { ...eth, address: eth.address[base.id] },
      { ...weth, address: wethAddress[base.id] },
      { ...dai, address: mcdDaiAddress[base.id] },
      { ...usds, address: usdsL2Address[base.id] },
      { ...susds, address: sUsdsL2Address[base.id] }
    ],
    [arbitrum.id]: [
      { ...usdc, address: usdcL2Address[arbitrum.id] },
      { ...usdt, address: usdtAddress[arbitrum.id] },
      { ...eth, address: eth.address[arbitrum.id] },
      { ...weth, address: wethAddress[arbitrum.id] },
      { ...dai, address: mcdDaiAddress[arbitrum.id] },
      { ...usds, address: usdsL2Address[arbitrum.id] },
      { ...susds, address: sUsdsL2Address[arbitrum.id] }
    ],
    [unichain.id]: [
      { ...usdc, address: usdcL2Address[unichain.id] },
      { ...usds, address: usdsL2Address[unichain.id] },
      { ...susds, address: sUsdsL2Address[unichain.id] }
    ],
    [optimism.id]: [
      { ...usdc, address: usdcL2Address[optimism.id] },
      { ...usds, address: usdsL2Address[optimism.id] },
      { ...susds, address: sUsdsL2Address[optimism.id] }
    ]
  },
  tradeDisallowedPairs: {
    ETH: [weth.symbol as SUPPORTED_TOKEN_SYMBOLS],
    MKR: [sky.symbol as SUPPORTED_TOKEN_SYMBOLS]
  }
};
