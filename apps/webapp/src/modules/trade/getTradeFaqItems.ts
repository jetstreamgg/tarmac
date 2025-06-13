import {
  isBaseChainId,
  isArbitrumChainId,
  isOptimismChainId,
  isUnichainChainId,
  isL2ChainId,
  isMainnetId
} from '@jetstreamgg/sky-utils';
import {
  L2GeneralFaqItems,
  baseFaqItems,
  arbitrumFaqItems,
  optimismFaqItems,
  unichainFaqItems
} from '../ui/constants/sharedFaqItems';

export const getTradeFaqItems = (chainId: number) => [
  ...(isMainnetId(chainId) ? mainnetFaqItems : []),
  ...generalFaqItems,
  ...L2GeneralFaqItems,
  ...(isBaseChainId(chainId) ? baseFaqItems : []),
  ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : []),
  ...(isOptimismChainId(chainId) ? optimismFaqItems : []),
  ...(isUnichainChainId(chainId) ? unichainFaqItems : []),
  ...(isL2ChainId(chainId) ? L2TradeFaqItems : [])
];

const generalFaqItems = [
  {
    question: 'Why would I trade tokens?',
    answer: `The following statements are provided for informational purposes only and are not intended to be construed as financial advice or recommendations on trading strategies. Your use of the Sky Protocol is at your own risk. Please see our [User Risk Documentation](https://docs.sky.money/user-risks) and [Terms of Use](https://docs.sky.money/legal-terms) for further information.  

Market participants trade crypto for a variety of reasons. For example, users may trade crypto for portfolio diversification and to participate in DeFi. Regardless of the motivation, crypto trading can provide a diverse range of opportunities to market participants depending on their goals and risk appetite.

When you trade USDC, USDT, ETH or SKY for USDS via the Sky Protocol, you can use your USDS to access the Sky Savings Rate to access additional USDS over time, and to access Sky Token Rewards in the form of SKY governance tokens.

When you trade USDC, USDT, ETH and USDS for SKY, you can supply your SKY tokens to the Staking Engine of the Sky Protocol to access Staking Rewards. The Staking Engine enables you to create one or more positions, including positions that enable you to generate and borrow USDS against your supplied SKY and to delegate the voting power the SKY token provides.`
  },
  {
    question:
      'Why do I see activity in my Trade transaction history in the Sky.money web app if I’ve never used the Trade feature?',
    answer: `If you’ve accessed the Sky Savings Rate on Base or Arbitrum, a conversion from USDS or USDC to sUSDS would have been automatically triggered via the Peg Stability Module [(PSM)](#tooltip-psm). Therefore, you will see such activity in your Trade transaction history, despite not having traded.  

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  }
];

const mainnetFaqItems = [
  {
    question: 'What is a trade?',
    answer: `A trade is the direct exchange of one cryptocurrency token for another. Trading can occur on decentralized exchanges (DEXs) and centralized exchanges (CEXs).

Eligible Sky.money web app users can trade tokens via an API integration with the third-party decentralized exchange [CoW Swap](https://swap.cow.fi/#/1/swap/WETH). The exact trade route is determined by CoW Swap and is not influenced by Sky.money or the Sky Protocol.

Note that price slippage—a change in price between the time of the trade order and its execution on the blockchain—can occur due to market volatility. When you trade via the Sky.money web app, you can set your slippage tolerance level.
`
  },
  {
    question: 'Is trading using Sky.money free?',
    answer: `Accessing the Sky.money web app is free. Trading, however, may involve a fee imposed by the third-party decentralized exchange (i.e., [CoW Swap](https://swap.cow.fi/#/1/swap/WETH)) integrated with the non-custodial Sky Protocol that is used to make the trade. In addition, you will likely pay a blockchain network transaction fee called a gas fee, which is neither controlled, imposed nor received by Sky.money or the Sky Protocol. This fee is calculated based on current Ethereum network demand and the amount of gas required to process your transaction. 

If you have shied away from the Ethereum blockchain due to the high price of gas, the Sky Protocol’s SkyLink system enables users to move their Ethereum Mainnet-based Sky assets between supported L2 networks, including Base and Arbitrum, with reduced fees and faster transaction speeds. 
`
  }
];

const L2TradeFaqItems = [
  {
    question: 'Which Sky tokens can I trade on supported L2s?',
    answer:
      'USDS and sUSDS are available to trade on supported Layer 2 (L2) networks using the Sky.money web app.'
  },
  {
    question: 'Which tokens can I trade on supported L2s?',
    answer: `Using the Sky.money web app, you can interact with the Peg Stability Module [(PSM)](#tooltip-psm) for conversions to/from USDS, sUSDS and USDC. The PSM handles conversions programmatically, driven at your direction, between these pairs directly. 

On some supported L2s, you can also access the Sky Savings Rate. Importantly, note that what separates the Base network from other L2s is that it enables free transfers of USDC; however, blockchain (gas) fees may apply. 

SkyLink is the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds. 
`
  },
  {
    question: 'How does trading on supported L2s differ from trading on Ethereum?',
    answer: `On Ethereum mainnet, the Sky.money web app features a native integration of [CoW Swap](https://swap.cow.fi), a third-party decentralized exchange (DEX) aggregator. On supported L2s, converting between tokens is made possible through a Peg Stability Module [(PSM)](#tooltip-psm). Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.
`
  }
];
