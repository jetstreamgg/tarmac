import { sepolia, mainnet, base, arbitrum, optimism, unichain } from 'wagmi/chains';
import {
  usdcAddress,
  usdcSepoliaAddress,
  usdtAddress,
  usdtSepoliaAddress,
  TOKENS,
  wethAddress,
  mcdDaiAddress,
  wethSepoliaAddress,
  mcdDaiSepoliaAddress,
  usdsAddress,
  ETH_ADDRESS,
  mkrAddress,
  skyAddress,
  spkAddress,
  usdcL2Address,
  usdsL2Address
} from '@jetstreamgg/sky-hooks';
import { tenderly, tenderlyBase, tenderlyArbitrum } from '@/data/wagmi/config/config.default';
import {
  TENDERLY_CHAIN_ID,
  TENDERLY_BASE_CHAIN_ID,
  TENDERLY_ARBITRUM_CHAIN_ID
} from '@/data/wagmi/config/testTenderlyChain';

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
  [sepolia.id]: [
    // The USDC token that COW uses has 18 decimals, instead of 6
    { ...usdc, address: usdcSepoliaAddress[sepolia.id], decimals: 18 },
    { ...usdt, address: usdtSepoliaAddress[sepolia.id] },
    { ...eth, address: ETH_ADDRESS },
    { ...weth, address: wethSepoliaAddress[sepolia.id] },
    { ...dai, address: mcdDaiSepoliaAddress[sepolia.id] }
  ],
  [base.id]: [
    { ...usdc, address: usdcL2Address[base.id] },
    { ...usds, address: usdsL2Address[base.id] },
    { ...eth, address: ETH_ADDRESS }
  ],
  [arbitrum.id]: [
    { ...usdc, address: usdcL2Address[arbitrum.id] },
    { ...usds, address: usdsL2Address[arbitrum.id] },
    { ...eth, address: ETH_ADDRESS }
  ],
  [tenderlyBase.id]: [
    { ...usdc, address: usdcL2Address[TENDERLY_BASE_CHAIN_ID] },
    { ...usds, address: usdsL2Address[TENDERLY_BASE_CHAIN_ID] }
  ],
  [tenderlyArbitrum.id]: [
    { ...usdc, address: usdcL2Address[TENDERLY_ARBITRUM_CHAIN_ID] },
    { ...usds, address: usdsL2Address[TENDERLY_ARBITRUM_CHAIN_ID] }
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
  [sepolia.id]: [
    { ...eth, address: ETH_ADDRESS },
    { ...weth, address: wethSepoliaAddress[sepolia.id] },
    { ...dai, address: mcdDaiSepoliaAddress[sepolia.id] }
  ],
  [base.id]: [
    { ...usds, address: usdsL2Address[base.id] },
    { ...eth, address: ETH_ADDRESS }
  ],
  [arbitrum.id]: [
    { ...usds, address: usdsL2Address[arbitrum.id] },
    { ...eth, address: ETH_ADDRESS }
  ],
  [tenderlyBase.id]: [{ ...usds, address: usdsL2Address[TENDERLY_BASE_CHAIN_ID] }],
  [tenderlyArbitrum.id]: [{ ...usds, address: usdsL2Address[TENDERLY_ARBITRUM_CHAIN_ID] }],
  [optimism.id]: [
    { ...usds, address: usdsL2Address[optimism.id] },
    { ...eth, address: ETH_ADDRESS }
  ],
  [unichain.id]: [
    { ...usds, address: usdsL2Address[unichain.id] },
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
  [sepolia.id]: [
    // The USDC token that COW uses has 18 decimals, instead of 6
    { ...usdc, address: usdcSepoliaAddress[sepolia.id], decimals: 18 },
    { ...usdt, address: usdtSepoliaAddress[sepolia.id] },
    { ...eth, address: ETH_ADDRESS },
    { ...weth, address: wethSepoliaAddress[sepolia.id] },
    { ...dai, address: mcdDaiSepoliaAddress[sepolia.id] }
  ],
  [base.id]: [
    { ...usdc, address: usdcL2Address[base.id] },
    { ...usds, address: usdsL2Address[base.id] }
  ],
  [arbitrum.id]: [
    { ...usdc, address: usdcL2Address[arbitrum.id] },
    { ...usds, address: usdsL2Address[arbitrum.id] }
  ],
  [tenderlyBase.id]: [
    { ...usdc, address: usdcL2Address[TENDERLY_BASE_CHAIN_ID] },
    { ...usds, address: usdsL2Address[TENDERLY_BASE_CHAIN_ID] }
  ],
  [tenderlyArbitrum.id]: [
    { ...usdc, address: usdcL2Address[TENDERLY_ARBITRUM_CHAIN_ID] },
    { ...usds, address: usdsL2Address[TENDERLY_ARBITRUM_CHAIN_ID] }
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
