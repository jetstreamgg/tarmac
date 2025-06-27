// Default configuration used site-wide

import { base, mainnet, sepolia, arbitrum, unichain, optimism } from 'wagmi/chains';
import { WidgetsConfig } from './types/widgets-config';
import {
  usdsAddress,
  mcdDaiAddress,
  wethAddress,
  usdcAddress,
  usdtAddress,
  wethSepoliaAddress,
  usdcSepoliaAddress,
  usdtSepoliaAddress,
  mcdDaiSepoliaAddress,
  mkrAddress,
  skyAddress,
  TOKENS,
  sUsdsAddress,
  ETH_ADDRESS,
  usdcL2Address,
  usdsL2Address,
  sUsdsL2Address,
  spkAddress
} from '@jetstreamgg/sky-hooks';
import {
  TENDERLY_ARBITRUM_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  TENDERLY_CHAIN_ID
} from '@widgets/shared/constants';
import { SUPPORTED_TOKEN_SYMBOLS } from '..';

const { usds, mkr, sky, susds, eth, weth, usdc, usdt, dai, spk } = TOKENS;

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
      { ...mkr, address: mkrAddress[mainnet.id] },
      { ...sky, address: skyAddress[mainnet.id] },
      { ...spk, address: spkAddress[mainnet.id] }
    ],
    [TENDERLY_CHAIN_ID]: [
      eth,
      { ...weth, address: wethAddress[TENDERLY_CHAIN_ID] },
      { ...usdc, address: usdcAddress[TENDERLY_CHAIN_ID] },
      { ...usdt, address: usdtAddress[TENDERLY_CHAIN_ID] },
      { ...dai, address: mcdDaiAddress[TENDERLY_CHAIN_ID] },
      { ...usds, address: usdsAddress[TENDERLY_CHAIN_ID] },
      { ...mkr, address: mkrAddress[TENDERLY_CHAIN_ID] },
      { ...sky, address: skyAddress[TENDERLY_CHAIN_ID] },
      { ...spk, address: spkAddress[TENDERLY_CHAIN_ID] }
    ],
    [base.id]: [
      eth,
      { ...usdc, address: usdcL2Address[base.id] },
      { ...usds, address: usdsL2Address[base.id] },
      { ...susds, address: sUsdsL2Address[base.id] }
    ],
    [arbitrum.id]: [
      eth,
      { ...usdc, address: usdcL2Address[arbitrum.id] },
      { ...usds, address: usdsL2Address[arbitrum.id] },
      { ...susds, address: sUsdsL2Address[arbitrum.id] }
    ],
    [TENDERLY_BASE_CHAIN_ID]: [
      eth,
      { ...usdc, address: usdcL2Address[base.id] },
      { ...usds, address: usdsL2Address[base.id] },
      { ...susds, address: sUsdsL2Address[base.id] }
    ],
    [TENDERLY_ARBITRUM_CHAIN_ID]: [
      eth,
      { ...usdc, address: usdcL2Address[TENDERLY_ARBITRUM_CHAIN_ID] },
      { ...usds, address: usdsL2Address[TENDERLY_ARBITRUM_CHAIN_ID] },
      { ...susds, address: sUsdsL2Address[TENDERLY_ARBITRUM_CHAIN_ID] }
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
      { ...sky, address: skyAddress[mainnet.id] }
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
      { ...sky, address: usdsAddress[TENDERLY_CHAIN_ID] }
    ],
    [base.id]: [
      { ...usdc, address: usdcL2Address[base.id] },
      { ...usds, address: usdsL2Address[base.id] },
      { ...susds, address: sUsdsL2Address[base.id] }
    ],
    [arbitrum.id]: [
      { ...usdc, address: usdcL2Address[arbitrum.id] },
      { ...usds, address: usdsL2Address[arbitrum.id] },
      { ...susds, address: sUsdsL2Address[arbitrum.id] }
    ],
    [TENDERLY_BASE_CHAIN_ID]: [
      { ...usdc, address: usdcL2Address[base.id] },
      { ...usds, address: usdsL2Address[base.id] },
      { ...susds, address: sUsdsL2Address[base.id] }
    ],
    [TENDERLY_ARBITRUM_CHAIN_ID]: [
      { ...usdc, address: usdcL2Address[TENDERLY_ARBITRUM_CHAIN_ID] },
      { ...usds, address: usdsL2Address[TENDERLY_ARBITRUM_CHAIN_ID] },
      { ...susds, address: sUsdsL2Address[TENDERLY_ARBITRUM_CHAIN_ID] }
    ],
    [sepolia.id]: [
      // The USDC token that COW uses has 18 decimals, instead of 6
      { ...usdc, address: usdcSepoliaAddress[sepolia.id], decimals: 18 },
      { ...usdt, address: usdtSepoliaAddress[sepolia.id] },
      { ...eth, address: ETH_ADDRESS },
      { ...weth, address: wethSepoliaAddress[sepolia.id] },
      { ...dai, address: mcdDaiSepoliaAddress[sepolia.id] }
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
