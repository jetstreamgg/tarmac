import {
  isArbitrumChainId,
  isBaseChainId,
  isL2ChainId,
  isOptimismChainId,
  isUnichainChainId
} from '@jetstreamgg/sky-utils';
import {
  L2GeneralFaqItems,
  arbitrumFaqItems,
  baseFaqItems,
  optimismFaqItems,
  unichainFaqItems
} from './sharedFaqItems';
import { getBundledTransactionsFaqItems } from './getBundledTransactionsFaqItems';
import { deduplicateFaqItems } from './utils';

export const getPsmConversionFaqItems = (chainId: number) => {
  const items = [
    ...generalFaqItems,
    ...(isL2ChainId(chainId) ? L2GeneralFaqItems : []),
    ...(isBaseChainId(chainId) ? baseFaqItems : []),
    ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : []),
    ...(isOptimismChainId(chainId) ? optimismFaqItems : []),
    ...(isUnichainChainId(chainId) ? unichainFaqItems : []),
    ...getBundledTransactionsFaqItems()
  ];

  return deduplicateFaqItems(items);
};

const generalFaqItems = [
  {
    question: 'What is 1:1 Conversion?',
    answer: `1:1 Conversion lets eligible users convert between **USDC** and **USDS** at a fixed 1:1 rate through the Peg Stability Module [(PSM)](#tooltip-psm). Unlike a routed market trade, this flow uses protocol conversion infrastructure rather than price discovery across liquidity venues.`,
    index: 0
  },
  {
    question: 'Is there slippage when using 1:1 Conversion?',
    answer: `No price slippage is applied in the 1:1 Conversion flow. When available, the conversion rate is fixed at **1 USDC = 1 USDS** and **1 USDS = 1 USDC**. You will still need to pay the applicable blockchain [gas fee](#tooltip-gas-fee) for submitting transactions.`,
    index: 1
  },
  {
    question: 'Why might 1:1 Conversion be unavailable?',
    answer: `Availability depends on the network and the state of the relevant PSM contracts. For example, the flow can be unavailable if the mainnet wrapper is not live, if a conversion direction is halted, or if there is insufficient available USDC liquidity for **USDS -> USDC** conversions. The interface will block confirmations when those conditions apply.`,
    index: 2
  },
  {
    question: 'Which networks support 1:1 Conversion?',
    answer:
      '1:1 Conversion is available on **Ethereum Mainnet** and supported Layer 2 networks where Sky’s PSM infrastructure is deployed. On Ethereum Mainnet, the flow uses the UsdsPsmWrapper. On supported L2s, the flow uses the PSM3 conversion contracts.',
    index: 3
  }
];
