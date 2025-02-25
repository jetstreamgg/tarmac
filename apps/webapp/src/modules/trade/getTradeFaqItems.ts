import { isBaseChainId, isArbitrumChainId } from '@jetstreamgg/utils';

export const getTradeFaqItems = (chainId: number) => [
  ...mainnetFaqItems,
  ...(isBaseChainId(chainId) ? baseFaqItems : []),
  ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : [])
];

const mainnetFaqItems = [
  {
    question: 'What is a trade?',
    answer: `A trade is the direct exchange of one cryptocurrency token for another at current market prices. Sky Protocol users can trade eligible tokens via an API integration with the third-party decentralised exchange [CoW Protocol](https://cow.fi/). These trades occur through smart contracts on the blockchain without relying on centralised entities. The exact trade route is determined by CoW Protocol and is not influenced by Sky.money or the Sky Protocol.

Note that price slippage—a change in price between the time of the trade order and its execution on the blockchain—can occur due to market volatility. When you trade via the Sky Protocol, you can set your slippage tolerance level.`
  },
  {
    question: 'Why would I trade tokens?',
    answer: `The following statements are provided for informational purposes only and are not intended to be construed as financial advice or recommendations on trading strategies. Your use of the Sky Protocol is at your own risk. Please see our User Risk Documentation and Terms of Use for further information.

When you trade USDC, USDT, ETH or SKY for USDS via the Sky Protocol, you can use your USDS to access the Sky Savings Rate to get additional USDS over time, and to get Sky Token Rewards in the form of Sky governance tokens.

When you trade USDC, USDT, ETH and USDS for SKY, you'll soon be able to use SKY to accumulate Activation Token Rewards and to participate in Sky ecosystem governance through a system of decentralised onchain voting.`
  },
  {
    question: 'Is trading using Sky.money free?',
    answer:
      'Trading may involve a fee imposed by the third-party decentralised exchange (i.e., CoW Protocol) integrated with the Sky Protocol that is used to make the trade. In addition, you will likely pay a blockchain network transaction fee called a gas fee. This fee is calculated based on current Ethereum network demand and the amount of gas required to process your transaction. Neither fee is controlled, imposed or received by Sky.money or the Sky Protocol.'
  },
  {
    question: 'What are Sky Token Rewards?',
    answer: `When you supply USDS to the Sky Token Rewards (STRs) module, you may receive Sky Token Rewards over time in the form of Sky governance tokens. Eventually, eligible users may be able to opt for Sky Token Rewards in the form of Sky Star governance tokens. Stars are independent, decentralised projects within the larger Sky ecosystem. They are designed to enable focused, fast-moving innovation and expansion, and serve as gateways to the decentralised Sky Protocol.

Eligible users will soon be able to use SKY to access the Activation and Sealed Activation modules to accumulate Activation Token Rewards, and to participate in Sky ecosystem governance through a system of decentralised onchain voting.`
  },
  {
    question: 'Which Sky tokens can I trade on Arbitrum using the Sky.money web app?',
    answer: `Currently, using the Sky.money web app, you can interact with the Peg Stability Module (PSM) for conversions to/from USDS, sUSDS and USDC. The PSM on Arbitrum handles conversions programmatically, driven at your direction, between these pairs directly. You can also access the Sky Savings Rate on Arbitrum.

PSMs are smart contracts designed to maintain the stability of stablecoins and enable users to convert certain stablecoins directly with the Sky Protocol at a fixed rate and with no fees; however, blockchain (gas) fees may apply. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol. 

- Subject to Sky Ecosystem Governance approval, Arbitrum (and other L2) users may soon be able to use SkyLink to access:
- Other Sky Ecosystem tokens, including SKY
- Sky Token Rewards
- Rewards in the form of Sky Star Agent tokens  

SkyLink is the Sky system that provides the rails for Sky Ecosystem projects to bridge assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks.
`
  },
  {
    question:
      'Why do I see activity in my Trade transaction history in the Sky.money web app if I’ve never used the Trade feature?',
    answer: `If you’ve accessed the Sky Savings Rate on Arbitrum, a conversion from USDS or USDC to sUSDS would have been automatically triggered via the Peg Stability Module (PSM). Therefore, you will see such activity in your Trade transaction history, despite not having traded.  

PSMs are smart contracts designed to maintain the stability of stablecoins and enable users to convert certain stablecoins directly with the Sky Protocol at a fixed rate and with no fees; however, blockchain (gas) fees may apply. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  }
];

const baseFaqItems = [
  {
    question: 'What is Base?',
    answer: `[Base](https://www.base.org/) is a Coinbase-developed Layer 2 (L2) network that provides easy access to some L1 networks, including Ethereum and Solana, and other L2s. 

SkyLink, Sky’s bridge system, enhances your ability to manage your digital assets efficiently by seamlessly connecting your Ethereum L1-based Sky Protocol tokens and features to the Base network. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds. 
`
  },
  {
    question: 'Which Sky tokens can I trade on Base using the Sky.money web app?',
    answer: `Currently, using the Sky.money web app, you can trade between USDS, sUSDS and USDC on Base. You can also access the Sky Savings Rate on Base.

Subject to Sky Ecosystem Governance approval, Base (and other L2) users may soon be able to use SkyLink to access:
- Other Sky ecosystem tokens, including SKY
- Sky Token Rewards
- Rewards in the form of Sky Star Agent tokens

SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to bridge assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, seamlessly connects your Ethereum L1-based Sky Protocol tokens and features to the Base network. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds.
`
  },
  {
    question: 'Which Sky tokens can I trade on Base?',
    answer: 'Currently, USDS and sUSDS are available to trade on Base.'
  },
  {
    question: 'How does trading on Base differ from trading on Ethereum?',
    answer: `On Ethereum mainnet, the Sky.money web app features a native integration of [CoW Swap](https://swap.cow.fi/#/1/swap/WETH), a third-party decentralized exchange (DEX) aggregator. On Base, converting between tokens is made possible through a Peg Stability Module (PSM) deployed to Arbitrum and [powered by Spark](https://docs.spark.fi/dev/savings/spark-psm). PSMs are smart contracts designed to maintain the stability of stablecoins and enable users to convert certain stablecoins directly with the Sky Protocol at a fixed rate and with no fees; however, blockchain (gas) fees may apply. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.

PSMs are special smart contracts designed to maintain the stability of stablecoins and allow users to trade certain stablecoins directly with the Sky Protocol at a fixed rate and with relatively low fees. 
`
  },
  {
    question:
      'Why do I see activity in my Trade transaction history in the Sky.money app if I’ve never used the Trade widget?',
    answer: `If you’ve accessed the Sky Savings Rate on Base, a conversion from USDS or USDC to sUSDS would have been automatically triggered via the Peg Stability Module (PSM). Therefore, you will see such activity in your Trade transaction history, despite not having traded. 
      
      PSMs are smart contracts designed to maintain the stability of stablecoins and enable users to convert certain stablecoins directly with the Sky Protocol at a fixed rate and with no fees; however, blockchain (gas) fees may apply. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.`
  }
];

const arbitrumFaqItems = [
  {
    question: 'What is Arbitrum?',
    answer: `[Arbitrum](https://arbitrum.io/) is a Layer 2 (L2) scaling solution designed to improve the scalability and efficiency of Ethereum. Specifically, it is an Optimistic roll-up built on top of the Ethereum blockchain, relying on Ethereum for security and consensus. Although it functions like an independent network for users interacting with it, Arbitrum is not a standalone Layer 1 (L1) blockchain. 

SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to bridge assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, enhances your ability to manage your digital assets efficiently by seamlessly connecting your Ethereum L1-based Sky Protocol tokens and features to Arbitrum. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds.
`
  },
  {
    question: 'Which Sky tokens can I trade on Arbitrum?',
    answer: 'Currently, USDS, sUSDS are available to trade on Arbitrum'
  },
  {
    question: 'How does trading on Arbitrum differ from trading on Ethereum?',
    answer: `On Ethereum mainnet, the Sky.money web app features a native integration of [CoW Swap](https://swap.cow.fi/#/1/swap/WETH), a third-party decentralized exchange (DEX) aggregator. On Arbitrum, converting between tokens is made possible through a Peg Stability Module (PSM) deployed to Arbitrum and [powered by Spark](https://docs.spark.fi/dev/savings/spark-psm). 

PSMs are smart contracts designed to maintain the stability of stablecoins and enable users to convert certain stablecoins directly with the Sky Protocol at a fixed rate and with no fees; however, blockchain (gas) fees may apply. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  }
];
