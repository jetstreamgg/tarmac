import { mainnet, base, arbitrum, optimism, unichain } from 'wagmi/chains';
import {
  usdcAddress,
  usdtAddress,
  TOKENS,
  wethAddress,
  mcdDaiAddress,
  usdsAddress,
  ETH_ADDRESS,
  mkrAddress,
  skyAddress,
  spkAddress,
  usdcL2Address,
  usdsL2Address
} from '@jetstreamgg/sky-hooks';
import { tenderly } from '@/data/wagmi/config/config.default';
import { TENDERLY_CHAIN_ID } from '@/data/wagmi/config/testTenderlyChain';

const { usdc, usdt, eth, weth, dai, usds, mkr, sky, spk } = TOKENS;

export const restrictedBalancesTokenList = {
  [mainnet.id]: [
    { ...usdc, address: usdcAddress[mainnet.id] },
    { ...usdt, address: usdtAddress[mainnet.id] },
    { ...eth, address: eth.address[mainnet.id] },
    { ...weth, address: wethAddress[mainnet.id] },
    { ...dai, address: mcdDaiAddress[mainnet.id] },
    { ...usds, address: usdsAddress[mainnet.id] },
    { ...mkr, address: mkrAddress[mainnet.id] },
    { ...sky, address: skyAddress[mainnet.id] },
    { ...spk, address: spkAddress[mainnet.id] }
  ],
  [tenderly.id]: [
    { ...usdc, address: usdcAddress[TENDERLY_CHAIN_ID] },
    { ...usdt, address: usdtAddress[TENDERLY_CHAIN_ID] },
    { ...eth, address: eth.address[TENDERLY_CHAIN_ID] },
    { ...weth, address: wethAddress[TENDERLY_CHAIN_ID] },
    { ...dai, address: mcdDaiAddress[TENDERLY_CHAIN_ID] },
    { ...usds, address: usdsAddress[TENDERLY_CHAIN_ID] },
    { ...mkr, address: mkrAddress[TENDERLY_CHAIN_ID] },
    { ...sky, address: skyAddress[TENDERLY_CHAIN_ID] },
    { ...spk, address: spkAddress[TENDERLY_CHAIN_ID] }
  ],
  [base.id]: [
    { ...usdc, address: usdcL2Address[base.id] },
    { ...usdt, address: usdtAddress[base.id] },
    { ...usds, address: usdsL2Address[base.id] },
    { ...eth, address: ETH_ADDRESS },
    { ...weth, address: wethAddress[base.id] },
    { ...dai, address: mcdDaiAddress[base.id] }
  ],
  [arbitrum.id]: [
    { ...usdc, address: usdcL2Address[arbitrum.id] },
    { ...usdt, address: usdtAddress[arbitrum.id] },
    { ...usds, address: usdsL2Address[arbitrum.id] },
    { ...eth, address: ETH_ADDRESS },
    { ...weth, address: wethAddress[arbitrum.id] },
    { ...dai, address: mcdDaiAddress[arbitrum.id] }
  ],
  [optimism.id]: [
    { ...usdc, address: usdcL2Address[optimism.id] },
    { ...usds, address: usdsL2Address[optimism.id] }
  ],
  [unichain.id]: [
    { ...usdc, address: usdcL2Address[unichain.id] },
    { ...usds, address: usdsL2Address[unichain.id] }
  ]
};

// Remove USDC and USDT from the list as they're only used for trade
export const restrictedBalancesTokenListMiCa = {
  [mainnet.id]: [
    { ...eth, address: eth.address[mainnet.id] },
    { ...weth, address: wethAddress[mainnet.id] },
    { ...dai, address: mcdDaiAddress[mainnet.id] },
    { ...usds, address: usdsAddress[mainnet.id] },
    { ...mkr, address: mkrAddress[mainnet.id] },
    { ...sky, address: skyAddress[mainnet.id] },
    { ...spk, address: spkAddress[mainnet.id] }
  ],
  [tenderly.id]: [
    { ...eth, address: eth.address[TENDERLY_CHAIN_ID] },
    { ...weth, address: wethAddress[TENDERLY_CHAIN_ID] },
    { ...dai, address: mcdDaiAddress[TENDERLY_CHAIN_ID] },
    { ...usds, address: usdsAddress[TENDERLY_CHAIN_ID] },
    { ...mkr, address: mkrAddress[TENDERLY_CHAIN_ID] },
    { ...sky, address: skyAddress[TENDERLY_CHAIN_ID] },
    { ...spk, address: spkAddress[TENDERLY_CHAIN_ID] }
  ],
  [base.id]: [
    { ...usds, address: usdsL2Address[base.id] },
    { ...usdc, address: usdcL2Address[base.id] },
    { ...eth, address: ETH_ADDRESS }
  ],
  [arbitrum.id]: [
    { ...usds, address: usdsL2Address[arbitrum.id] },
    { ...usdc, address: usdcL2Address[arbitrum.id] },
    { ...eth, address: ETH_ADDRESS }
  ],
  [optimism.id]: [
    { ...usds, address: usdsL2Address[optimism.id] },
    { ...usdc, address: usdcL2Address[optimism.id] },
    { ...eth, address: ETH_ADDRESS }
  ],
  [unichain.id]: [
    { ...usds, address: usdsL2Address[unichain.id] },
    { ...usdc, address: usdcL2Address[unichain.id] },
    { ...eth, address: ETH_ADDRESS }
  ]
};

export const restrictedTradeTokenList = {
  [mainnet.id]: [
    { ...usdc, address: usdcAddress[mainnet.id] },
    { ...usdt, address: usdtAddress[mainnet.id] },
    { ...eth, address: eth.address[mainnet.id] },
    { ...weth, address: wethAddress[mainnet.id] },
    { ...dai, address: mcdDaiAddress[mainnet.id] },
    { ...usds, address: usdsAddress[mainnet.id] }
  ],
  [tenderly.id]: [
    { ...usdc, address: usdcAddress[TENDERLY_CHAIN_ID] },
    { ...usdt, address: usdtAddress[TENDERLY_CHAIN_ID] },
    { ...eth, address: eth.address[TENDERLY_CHAIN_ID] },
    { ...weth, address: wethAddress[TENDERLY_CHAIN_ID] },
    { ...dai, address: mcdDaiAddress[TENDERLY_CHAIN_ID] },
    { ...usds, address: usdsAddress[TENDERLY_CHAIN_ID] }
  ],
  [base.id]: [
    { ...usdc, address: usdcL2Address[base.id] },
    { ...usdt, address: usdtAddress[base.id] },
    { ...eth, address: eth.address[base.id] },
    { ...weth, address: wethAddress[base.id] },
    { ...dai, address: mcdDaiAddress[base.id] },
    { ...usds, address: usdsL2Address[base.id] }
  ],
  [arbitrum.id]: [
    { ...usdc, address: usdcL2Address[arbitrum.id] },
    { ...usdt, address: usdtAddress[arbitrum.id] },
    { ...eth, address: eth.address[arbitrum.id] },
    { ...weth, address: wethAddress[arbitrum.id] },
    { ...dai, address: mcdDaiAddress[arbitrum.id] },
    { ...usds, address: usdsL2Address[arbitrum.id] }
  ],
  [optimism.id]: [
    { ...usdc, address: usdcL2Address[optimism.id] },
    { ...usds, address: usdsL2Address[optimism.id] }
  ],
  [unichain.id]: [
    { ...usdc, address: usdcL2Address[unichain.id] },
    { ...usds, address: usdsL2Address[unichain.id] }
  ]
};
