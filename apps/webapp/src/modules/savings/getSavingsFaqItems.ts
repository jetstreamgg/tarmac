import { isBaseChainId, isArbitrumChainId } from '@jetstreamgg/utils';

export const getSavingsFaqItems = (chainId: number, isConnected: boolean) => [
  ...mainnetFaqItems,
  ...(isBaseChainId(chainId)
    ? isConnected
      ? [...baseFaqItems, ...connectedBaseFaqItems]
      : baseFaqItems
    : []),
  ...(isArbitrumChainId(chainId) ? arbitrumFaqItems : [])
];

const mainnetFaqItems = [
  {
    question: 'What is the Sky Savings Rate, and how does it work?',
    answer: `The Sky Savings Rate is an automated token-accumulation mechanism for eligible users of the Sky Protocol. It takes into account the effect of accumulated USDS compounded in real time.

When you supply USDS to the Sky Savings Rate module, you access the Sky Savings Rate and receive sUSDS tokens. Those sUSDS tokens serve as a digital record of your USDS interaction with the module and any value accrued to your position.

The Sky Protocol dynamically adds USDS tokens to the pool every few seconds, in accordance with the Sky Savings Rate percentage. As those tokens auto-accumulate in the pool over time, the value of the sUSDS you hold may gradually increase. Therefore, when you choose to redeem your sUSDS for USDS—which you can do anytime—the total USDS you will receive will equal the amount you originally supplied, plus any additional USDS accumulated. 

The Sky Savings Rate percentage is variable, determined by Sky Ecosystem Governance through a process of decentralized onchain voting.

The conversion rate between USDS and sUSDS is determined programmatically by smart contracts, but the dollar value should match given that there are no fees involved. When redeeming sUSDS for USDS, one would expect an increase in net USDS tokens in accordance with the Sky Savings Rate multiplied by the duration.
`
  },
  {
    question: 'Does it cost anything to access the Sky Savings Rate?',
    answer: `Accessing the Sky Savings Rate via the Sky.money web app is free. However, any time you supply or withdraw assets to/from the Sky Savings Rate module of the Sky Protocol, you will incur a transaction fee, called a gas fee, for using the Ethereum blockchain network. That fee is neither controlled, imposed nor received by Sky.money or the Sky Protocol.

If you have shied away from the Ethereum blockchain due to the high price of gas, note that the average price of gas on Ethereum has dropped significantly as a result of the 2024 Dencun upgrade. Note, too, that. you can use the Sky.money web app to access the Sky Savings Rate on the Base network with reduced transaction costs. 
`
  },
  {
    question: 'What is USDS?',
    answer: `USDS is a stablecoin of the decentralized Sky Protocol and the upgrade of DAI. It is backed by a surplus of collateral and soft-pegged to the value of the U.S. dollar, meaning it is designed to maintain a value equal to or close to a dollar.

USDS is freely transferable and can be used in connection with any software protocol or platform that supports it. For example, you can use USDS to participate in the Sky Savings Rate to accumulate additional USDS, and to access Sky Token Rewards in the form of SKY tokens via the Sky.money web app.  

The Sky Protocol is governed by a community of broad and diversified individuals and entities from around the world, who hold Sky governance tokens and support the Sky Ecosystem by participating in a system of decentralized onchain voting. USDS powers the open Sky Ecosystem.

USDS is also currently available on networks other than Ethereum Mainnet, including Solana, Base and Arbitrum. You can follow the growth of USDS and all Sky Protocol tokens using the [Sky Ecosystem Dashboard](https://info.sky.money/).
`
  },
  {
    question: 'Can I supply/withdraw USDS to/from the Sky Savings Rate module anytime?',
    answer:
      'Yes, you can supply USDS tokens to the Sky Savings Rate module of the Sky Protocol at any time. You can also withdraw your original supply of USDS, as well as any accumulated sUSDS, from the module at any time. sUSDS is the savings token of the Sky Savings Rate module of the Protocol.'
  },
  {
    question: 'What is sUSDS?',
    answer: `sUSDS is a savings token for eligible Sky Protocol users. When you supply USDS to the Sky Savings Rate module of the Protocol, you access the Sky Savings Rate and receive sUSDS tokens. These sUSDS tokens serve as a digital record of your USDS interaction with the Sky Savings Rate module and any value accrued to your position.

The Sky Protocol dynamically adds USDS tokens to the pool every few seconds, in accordance with the Sky Savings Rate percentage. As those tokens auto-accumulate in the pool over time, the value of the sUSDS you hold may gradually increase. The Sky Savings Rate percentage is variable, determined by Sky Ecosystem Governance through a process of decentralized onchain voting. Therefore, when you choose to redeem your sUSDS for USDS—which you can do anytime—the total USDS you will receive will equal the amount you originally supplied, plus any additional USDS accumulated.

The conversion rate between USDS and sUSDS is determined programmatically by smart contracts, but the dollar value should match given that there are no fees involved. When redeeming sUSDS for USDS, one would expect an increase in net USDS tokens in accordance with the Sky Savings Rate multiplied by the duration.
`
  },
  {
    question: 'Can I trade sUSDS on the open market?',
    answer:
      'Yes, eligible sUSDS holders can access the Sky.money web app to trade the tokens via an API integration with the third-party decentralized exchange [CoW Swap](https://swap.cow.fi/#/1/swap/WETH). sUSDS holders are also free to access any other protocol or exchange that supports sUSDS trading; however, users do so at their own risk. Sky.money is not responsible for any loss or damages incurred while using such third-party platforms.'
  },
  {
    question:
      'Why do I see activity in my Savings transaction history in the Sky.money app if I’ve never used the Savings feature?',
    answer:
      'When you trade sUSDS for another token (or vice versa), sUSDS is automatically supplied to (or withdrawn from) the Sky Savings Rate module. These transactions are recorded in your Savings transaction history as a “supply” or “withdrawal.” Your Savings balance will also update automatically to reflect the increase or decrease in the amount of sUSDS you hold.'
  },
  {
    question:
      'Why is the USDS amount I supplied to the Sky Savings Rate module different from the converted sUSDS amount, and how is that conversion calculated?',
    answer: `The USDS you supply to the Sky Savings Rate module enables you to receive sUSDS tokens. The sUSDS tokens serve as a digital record of your USDS interaction with the module and any value accrued to your position. The decentralized Sky Protocol dynamically adds USDS tokens to the pool every few seconds, in accordance with the Sky Savings Rate. As those tokens auto-accumulate in the pool over time, the value of the sUSDS you hold may gradually increase. 

The conversion rate between USDS and sUSDS is determined programmatically by smart contracts, but the dollar value should match given that there are no fees involved. When redeeming sUSDS for USDS at a later point in time, one would expect an increase in net USDS tokens in accordance with the Sky Savings Rate multiplied by the duration.
`
  }
];

const baseFaqItems = [
  {
    question: 'What is Base?',
    answer: `Base is a Coinbase-developed Layer 2 (L2) network that provides easy access to some L1 networks, including Ethereum, Solana, and other L2s. 

SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, seamlessly connects your Ethereum L1-based Sky Protocol tokens and features to the Base network. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds. 
`
  },
  {
    question:
      'Why is the USDS amount I supplied to the Sky Savings Rate module different from the converted sUSDS amount, and how is that conversion calculated?',
    answer: `The USDS you supply to the Sky Savings Rate module enables you to receive sUSDS tokens. The sUSDS tokens serve as a digital record of your USDS interaction with the module and any value accrued to your position. The decentralised Sky Protocol dynamically adds USDS tokens to the pool every few seconds, in accordance with the Sky Savings Rate. As those tokens auto-accumulate in the pool over time, the value of the sUSDS you hold may gradually increase. 

The conversion rate between USDS and sUSDS is determined programmatically by smart contracts, but the dollar value should match given that there are no fees involved. When redeeming sUSDS for USDS at a later point in time, one would expect an increase in net USDS tokens in accordance with the Sky Savings Rate multiplied by the duration.
`
  },
  {
    question: 'Which tokens can I supply to and withdraw from the Savings Rate Module on Base?',
    answer: `There is no native Sky Savings Rate module deployed to Base. On Base, both USDS and USDC are currently supported. This is made possible through a Peg Stability Module (PSM) deployed to the Base blockchain and [powered by Spark](https://docs.spark.fi/dev/savings/cross-chain-savings-rate-oracle). 

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  },
  {
    question: 'Is the Sky Savings Rate percentage the same on Ethereum Mainnet and Base?',
    answer: `Yes, the Sky Savings Rate percentage on Base tracks the rate on Ethereum Mainnet. This is done programmatically in the Peg Stability Module (PSM) deployed on Base. 

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  }
];

const connectedBaseFaqItems = [
  {
    question: 'Is the Savings feature experience on Base the same as on Ethereum Mainnet?',
    answer: `As an end-user of the Sky.money web app, the experience of using the Savings feature on Base and Ethereum is very similar. However, given that no native Sky Savings Rate module is deployed to Base, when using the Sky.money web app on Base you always interact with the Peg Stability Module (PSM) for conversions to/from sUSDS, USDS, and USDC.

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.

SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, seamlessly connects your Ethereum L1-based Sky Protocol tokens and features to the Base network. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds. 
`
  }
];

const arbitrumFaqItems = [
  {
    question: 'What is Arbitrum?',
    answer: `Arbitrum is a Layer 2 (L2) scaling solution designed to improve the scalability and efficiency of Ethereum. Specifically, it is an Optimistic roll-up built on top of the Ethereum blockchain, relying on Ethereum for security and consensus. Although it functions like an independent network for users interacting with it, Arbitrum is not a standalone Layer 1 (L1) blockchain. 

SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, enhances your ability to manage your digital assets efficiently by seamlessly connecting your Ethereum L1-based Sky Protocol tokens and features to Arbitrum. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds.`
  },
  {
    question: 'Which tokens can I supply to and withdraw from the Savings Rate Module on Arbitrum?',
    answer: `There is no native Sky Savings Rate module deployed to Arbitrum. On Arbitrum, both USDS and USDC are currently supported. This is made possible through a Peg Stability Module (PSM) deployed to Arbitrum and [powered by Spark](https://docs.spark.fi/dev/savings/cross-chain-savings-rate-oracle). 

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.
`
  },
  {
    question: 'Is the Savings feature experience on Arbitrum the same as on Ethereum Mainnet?',
    answer: `As an end-user of the Sky.money web app, the experience of using the Savings feature on Arbitrum and Ethereum is very similar. However, given that no native Sky Savings Rate module is deployed to Arbitrum, when using the Sky.money web app on Arbitrum you always interact with the Peg Stability Module (PSM) for conversions to/from sUSDS, USDS, and USDC.


PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.

SkyLink, the Sky system that provides the rails for Sky Ecosystem projects to link assets between the Sky Protocol on Ethereum Mainnet and supported L2 networks, seamlessly connects your Ethereum L1-based Sky Protocol tokens and features to Arbitrum. If you have shied away from the Ethereum blockchain due to the high price of gas, SkyLink introduces reduced fees and faster transaction speeds. 
`
  },
  {
    question: 'Is the Sky Savings Rate percentage the same on Ethereum Mainnet and Arbitrum?',
    answer: `Yes, the Sky Savings Rate percentage on Arbitrum tracks the rate on Ethereum Mainnet. This is done programmatically in the Peg Stability Module (PSM) deployed on Arbitrum. 

PSMs are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees; however, blockchain (gas) fees may apply. PSMs are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.`
  }
];
