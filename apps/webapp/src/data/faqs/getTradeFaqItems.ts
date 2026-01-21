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
import { deduplicateFaqItems } from './utils';

export const getTradeFaqItems = (chainId: number) => {
  const items = [
    ...generalFaqItems,
    ...L2GeneralFaqItems,
    ...(isBaseChainId(chainId) ? baseFaqItems : []),
    ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : []),
    ...(isOptimismChainId(chainId) ? optimismFaqItems : []),
    ...(isUnichainChainId(chainId) ? unichainFaqItems : []),
    ...(isL2ChainId(chainId) ? L2TradeFaqItems : [])
  ];

  return deduplicateFaqItems(items);
};

const generalFaqItems = [
  {
    question: 'What is a trade?',
    answer: `A trade is the direct exchange of one cryptocurrency token for another. Trading can occur on decentralized exchanges (DEXs) and centralized exchanges (CEXs).

Eligible Sky.money web app users can trade tokens via an API integration with the third-party decentralized exchange [CoW Swap](https://swap.cow.fi/#/1/swap/WETH). The exact trade route is determined by CoW Swap and is not influenced by Sky.money or the Sky Protocol. Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.

Note that price slippage—a change in price between the time of the trade order and its execution on the blockchain—can occur due to market dynamics. When you trade via the Sky.money web app, you can set your slippage tolerance level.`,
    index: 0
  },
  {
    question: 'Why would I trade tokens?',
    answer: `The following statements are provided for informational purposes only and are not intended to be construed as financial advice or recommendations on trading strategies. Your use of the Sky Protocol is at your own risk. Please see our [User Risk Documentation](https://docs.sky.money/user-risks) and [Terms of Use](https://docs.sky.money/legal-terms) for further information.

Market participants trade crypto for a variety of reasons. For example, users may trade crypto for portfolio diversification and to participate in DeFi. Regardless of the motivation, crypto trading can provide a diverse range of opportunities to market participants depending on their goals and risk appetite.

Depending on your location and other criteria, you can use the Sky.money web app to trade:

• USDC, USDT, ETH and SKY for USDS, and vice versa. Once you have USDS, you can use it to access Sky Token Rewards and the [Sky Savings Rate](#tooltip-sky-savings-rate).
• USDC, USDT, ETH and USDS for SKY, and vice versa. Once you have SKY, you can use it to access the Staking Engine. The Staking Engine enables you to access Staking Rewards and create one or more positions, including positions that enable you to generate and [borrow](#tooltip-borrow) USDS against your supplied SKY and to delegate the voting power the SKY token provides.`,
    index: 1
  },
  {
    question: 'Is trading using Sky.money free?',
    answer: `Accessing the Sky.money web app is free. Trading, however, may involve a fee imposed by the third-party decentralized exchange (i.e., [CoW Swap](https://swap.cow.fi/#/1/swap/WETH)) integrated with the non-custodial Sky Protocol that is used to make the trade. In addition, you will likely pay a blockchain network transaction fee called a [gas fee](#tooltip-gas-fee), which is neither controlled, imposed nor received by Sky.money or the Sky Protocol. This fee is calculated based on current Ethereum network demand and the amount of gas required to process your transaction.

Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.`,
    index: 2
  },
  {
    question: 'What are Sky Token Rewards?',
    answer:
      'When you supply USDS to the Sky Token Rewards module of the Sky Protocol, you receive Sky Token Rewards over time. The USDS tokens, as well as the rewards received, are supplied to a non-custodial smart contract that represents the USDS pool of assets. That means no intermediary has custody of your supplied assets.',
    index: 3
  },
  {
    question: 'What is SkyLink?',
    answer:
      'SkyLink is Sky Ecosystem’s multichain solution connecting USDS, SKY and other Sky Ecosystem tokens from the Ethereum Mainnet to other chains and L2 protocols.',
    index: 4
  },
  {
    question: 'What are Layer 2 networks, and how do they benefit users?',
    answer: `Layer 2 (L2) networks are blockchain scalability solutions built on top of existing blockchains (Layer 1 or L1 networks). While L2s exist across several blockchains, they are most commonly used with the Ethereum blockchain, where they are designed to solve two major problems: high transaction (gas) fees and slow transaction speeds, which can hinder scalability.

L2 solutions usually work by processing transactions on their own blockchain, and then bundling those transactions and submitting them back to the underlying L1 as a single transaction for final validation, which drastically increases throughput.

Moving assets between L1 and L2 networks requires specialized protocols called bridges. While bridges can be designed to connect any two blockchain networks, L2 networks operate on top of L1s, inheriting their security, while delivering improved efficiency.

L2s used with Ethereum not only offer users lower fees and faster speeds (transactions can be near-instant), they can enable users to transact using the wallets and tools they are already familiar with. There is a tradeoff, however, as users bridging their assets between L1 and L2 networks generally must pay a transaction fee. For users making multiple transactions, the savings may outweigh that cost and you must use your own discretion. Also, L1 networks may provide stronger security guarantees compared to L2s, which often rely on centralized components and actors, which could potentially introduce points of failure.`,
    index: 5
  },
  {
    question: 'What can I do with my assets once they are linked to an L2 network?',
    answer:
      'On many L2s, you can perform the same types of transactions as on Ethereum Mainnet—i.e., trade tokens, use DeFi applications (dApps), etc.—but with reduced fees and faster transaction speeds. Many popular dApps have L2 versions, though not all are available on every L2. Please note that some features of Sky.money or the Sky Protocol may not be available on L2s.',
    index: 6
  }
];

const L2TradeFaqItems = [
  {
    question: 'Which tokens can I trade on supported L2s?',
    answer: `Supported trading pairs vary by network, depending also on your location and other criteria:

• **Ethereum Mainnet:** USDC, USDT, ETH, WETH, DAI, MKR, USDS, sUSDS, SKY, SPK

• **Base:** USDC, USDT, ETH, WETH, DAI, USDS, sUSDS

• **Arbitrum:** USDC, USDT, ETH, WETH, DAI, USDS, sUSDS

• **Optimism:** USDC, USDS, sUSDS

• **Unichain:** USDC, USDS, sUSDS

Using the Sky.money web app, you can interact with the Peg Stability Module (PSM) for conversions to and from **USDS**, **sUSDS**, and **USDC**. The PSM handles conversions programmatically, executed at your direction, between these pairs directly.

On some supported L2s, you can also access the [Sky Savings Rate](#tooltip-sky-savings-rate).

SkyLink is Sky Ecosystem’s multichain solution connecting USDS, SKY and other Sky Ecosystem tokens from the Ethereum Mainnet to other chains and L2 protocols.

Available tokens may evolve over time as new trading pairs are added. Please see the [Terms of Use](https://docs.sky.money/legal-terms) for Sky.money web app access eligibility.`,
    index: 0
  },
  {
    question: 'How does trading on supported L2s differ from trading on Ethereum?',
    answer: `On Ethereum Mainnet, Base, and Arbitrum, the Sky.money web app features a native integration of [CoW Swap](https://swap.cow.fi/#/1/swap/WETH), a third-party decentralized exchange (DEX) aggregator. Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.

On Optimism and Unichain, converting between tokens is made possible through a Peg Stability Module [(PSM)](#tooltip-psm).`,
    index: 1
  },
  {
    question:
      "Why do I see activity in my Trade transaction history in the Sky.money web app if I've never used the Trade feature?",
    answer:
      "If you've accessed the [Sky Savings Rate](#tooltip-sky-savings-rate) on a supported Layer 2 (L2) network, a conversion from USDS or USDC to sUSDS would have been automatically triggered via the Peg Stability Module [(PSM)](#tooltip-psm). Therefore, you will see such activity in your Trade transaction history, despite not having traded.",
    index: 2
  }
];
