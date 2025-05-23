import { isBaseChainId, isArbitrumChainId } from '@jetstreamgg/utils';

export const getTradeFaqItems = (chainId: number) => [
  ...[...mainnetFaqItems, ...skyLinkFaqItems],
  ...(isBaseChainId(chainId) ? baseFaqItems : []),
  ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : [])
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
    question: 'Why would I trade tokens?',
    answer: `The following statements are provided for informational purposes only and are not intended to be construed as financial advice or recommendations on trading strategies. Your use of the Sky Protocol is at your own risk. Please see our [User Risk Documentation](https://docs.sky.money/user-risks) and [Terms of Use](https://docs.sky.money/legal-terms) for further information.  

Market participants trade crypto for a variety of reasons. For example, users may trade crypto for portfolio diversification and to participate in DeFi. Regardless of the motivation, crypto trading can provide a diverse range of opportunities to market participants depending on their goals and risk appetite.

When you trade USDC, USDT, ETH or SKY for USDS via the Sky Protocol, you can use your USDS to access the Sky Savings Rate to access additional USDS over time, and to access Sky Token Rewards in the form of SKY governance tokens.

When you trade USDC, USDT, ETH and USDS for SKY,  you can supply your SKY tokens to the Staking Engine of the Sky Protocol to access Staking Rewards. The Staking Engine enables you to create one or more positions, including positions that enable you to generate and borrow USDS against your supplied SKY and to delegate the voting power the SKY token provides.`
  },
  {
    question: 'Is trading using Sky.money free?',
    answer: `Accessing the Sky.money web app is free. Trading, however, may involve a fee imposed by the third-party decentralized exchange (i.e., [CoW Swap](https://swap.cow.fi/#/1/swap/WETH)) integrated with the non-custodial Sky Protocol that is used to make the trade. In addition, you will likely pay a blockchain network transaction fee called a gas fee, which is neither controlled, imposed nor received by Sky.money or the Sky Protocol. This fee is calculated based on current Ethereum network demand and the amount of gas required to process your transaction. 

If you have shied away from the Ethereum blockchain due to the high price of gas, the Sky Protocol’s SkyLink system enables users to move their Ethereum Mainnet-based Sky assets between supported L2 networks, including Base and Arbitrum, with reduced fees and faster transaction speeds. 
`
  },
  {
    question: 'What are Sky Token Rewards?',
    answer:
      'When you supply USDS to the Sky Token Rewards module of the Sky Protocol, you receive Sky Token Rewards over time in the form of SKY governance tokens. The USDS, as well as the rewards received, are supplied to a non-custodial smart contract that represents the USDS pool of assets. That means no intermediary has custody of your supplied assets.'
  },
  {
    question: 'How does trading on Arbitrum differ from trading on Ethereum?',
    answer: `On Ethereum mainnet, the Sky.money web app features a native integration of [CoW Swap](https://swap.cow.fi/#/1/swap/WETH), a third-party decentralized exchange (DEX) aggregator. On Arbitrum, converting between tokens is made possible through a Peg Stability Module (PSM) deployed to Arbitrum and [powered by Spark](https://docs.spark.fi/dev/savings/spark-psm). 

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  },
  {
    question: 'How does trading on Base differ from trading on Ethereum?',
    answer: `On Ethereum mainnet, the Sky.money web app features a native integration of [CoW Swap](https://swap.cow.fi/#/1/swap/WETH), a third-party decentralized exchange (DEX) aggregator. On Base, converting between tokens is made possible through a Peg Stability Module (PSM) deployed to Base and [powered by Spark](https://docs.spark.fi/dev/savings/spark-psm). 

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  },
  {
    question:
      'Why do I see activity in my Trade transaction history in the Sky.money web app if I’ve never used the Trade feature?',
    answer: `If you’ve accessed the Sky Savings Rate on Base or Arbitrum, a conversion from USDS or USDC to sUSDS would have been automatically triggered via the Peg Stability Module (PSM). Therefore, you will see such activity in your Trade transaction history, despite not having traded.  

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  },
  {
    question: 'Which Sky tokens can I trade on Arbitrum using the Sky.money web app?',
    answer: `Currently, using the Sky.money web app, you can interact with the Peg Stability Module (PSM) for conversions to/from USDS, sUSDS and USDC. The PSM on Arbitrum handles conversions programmatically, driven at your direction, between these pairs directly. You can also access the Sky Savings Rate on Arbitrum.

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.

SkyLink is the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks.  
`
  },
  {
    question: 'Which Sky tokens can I trade on Base using the Sky.money web app?',
    answer: `Currently, using the Sky.money web app, you can trade between USDS, sUSDS and USDC on Base. You can also access the Sky Savings Rate on Base.
    
SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, seamlessly connects your Ethereum L1-based Sky Protocol tokens and features to the Base network. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds.
`
  }
];

const skyLinkFaqItems = [
  {
    question: 'What is SkyLink, and how does it work?',
    answer:
      'SkyLink is the Sky system that provides the rails for Sky Ecosystem projects, such as Spark, to bridge assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks. This enables end users on L2s, such as Base and Arbitrum for example, to tap into Sky Protocol features via the Sky Ecosystem projects’ rails.'
  },
  {
    question: 'What are Layer 2 networks, and how do they benefit users?',
    answer: `Layer 2 (L2) networks are blockchain scalability solutions built on top of existing blockchains (Layer 1 or L1 networks). While L2s exist across several blockchains, they are most commonly used with the Ethereum blockchain, where they are designed to solve two major problems: high transaction (gas) fees and slow transaction speeds, which can hinder scalability.

L2 solutions usually work by processing transactions on their own blockchain, and then bundling those transactions and submitting them back to the underlying L1 as a single transaction for final validation, which drastically increases the throughput. 

Moving assets between L1 and L2 networks requires specialized protocols called bridges. While bridges can be designed to connect any two blockchain networks, L2 networks operate on top of L1s, inheriting their security, while delivering improved efficiency. 

L2s used with Ethereum not only offer users much lower fees and much faster speeds (transactions can be near-instant), they can enable users to transact using the wallets and tools they are already familiar with. There is a tradeoff, however, as users bridging their assets between L1 and L2 networks generally must pay a transaction fee. For users making multiple transactions, the savings may outweigh that cost and you must use your own discretion. Also, L1 networks may provide stronger security guarantees compared to L2s, which often rely on centralized components and actors, which could potentially introduce points of failure.
`
  },
  {
    question: 'What can I do with my assets once they are bridged to an L2 network?',
    answer:
      'On many L2s, you can perform the same types of transactions as on Ethereum Mainnet—i.e., trade tokens, use DeFi applications (dApps), etc.— but with reduced fees and faster transaction speeds. Many popular dApps have L2 versions, though not all are available on every L2. Please note that some features of Sky.money or the Sky Protocol will not be available on L2s.'
  }
];

const baseFaqItems = [
  {
    question: 'What is Base?',
    answer: `Base is a Coinbase-developed Layer 2 (L2) network that provides easy access to some L1 networks, including Ethereum, Solana, and other L2s.

SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, seamlessly connects your Ethereum L1-based Sky Protocol tokens and features to the Base network. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds.`
  },
  {
    question: 'Which Sky tokens can I trade on Base?',
    answer: 'Currently, USDS and sUSDS are available to trade on Base.'
  },
  {
    question:
      'Why do I see activity in my Trade transaction history in the Sky.money web app if I’ve never used the Trade feature?',
    answer: `If you’ve accessed the Sky Savings Rate on Base, a conversion from USDS or USDC to sUSDS would have been automatically triggered via the Peg Stability Module (PSM). Therefore, you will see such activity in your Trade transaction history, despite not having traded.  

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  }
];

const arbitrumFaqItems = [
  {
    question: 'What is Arbitrum?',
    answer: `Arbitrum is a Layer 2 (L2) scaling solution designed to improve the scalability and efficiency of Ethereum. Specifically, it is an Optimistic roll-up built on top of the Ethereum blockchain, relying on Ethereum for security and consensus. Although it functions like an independent network for users interacting with it, Arbitrum is not a standalone Layer 1 (L1) blockchain. 

SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, enhances your ability to manage your digital assets efficiently by seamlessly connecting your Ethereum L1-based Sky Protocol tokens and features to Arbitrum. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds. 
`
  },
  {
    question: 'Which Sky tokens can I trade on Arbitrum?',
    answer: 'Currently, USDS and sUSDS are available to trade on Arbitrum.'
  },
  {
    question:
      'Why do I see activity in my Trade transaction history in the Sky.money web app if I’ve never used the Trade feature?',
    answer: `If you’ve accessed the Sky Savings Rate on Arbitrum, a conversion from USDS or USDC to sUSDS would have been automatically triggered via the Peg Stability Module (PSM). Therefore, you will see such activity in your Trade transaction history, despite not having traded.  

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  },
  {
    question: 'Which tokens can I supply to and withdraw from the Savings Rate Module on Arbitrum?',
    answer: `There is no native Sky Savings Rate module deployed to Arbitrum. On Arbitrum, both USDS and USDC are currently supported. This is made possible through a Peg Stability Module (PSM) deployed to Arbitrum and [powered by Spark](https://docs.spark.fi/dev/savings/cross-chain-savings-rate-oracle). 

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  }
];
