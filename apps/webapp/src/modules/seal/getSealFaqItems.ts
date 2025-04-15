export const getSealFaqItems = () => [
  {
    question: 'What are Seal Rewards?',
    answer: `Seal Rewards can be accessed when you supply MKR or SKY to the Seal Engine of the decentralised Sky Protocol. Currently, all Seal Rewards take the form of USDS. Eventually, subject to Sky ecosystem governance approval, Seal Rewards may also be available in the form of Sky Star tokens, including SPK, the governance token of the Spark decentralised community. You can choose the reward that you would like to receive.

Your supplied MKR tokens, as well as any rewards accumulated, automatically enter a non-custodial smart contract, which allows you to always remain in control of your supplied funds.

Seal reward rates are determined by Sky ecosystem decentralised governance.
`
  },
  {
    question: 'How are Seal Rewards rates determined?',
    answer:
      'Seal reward rates are determined by Sky ecosystem governance through a process of decentralised onchain voting.'
  },
  {
    question: 'How does the Seal Engine enable borrowing?',
    answer: `Sealing MKR or SKY into the Seal Engine enables you to access Seal Rewards by creating a position through which you can generate and borrow USDS against those tokens. You can seal and unseal your collateral at any time, and draw or pay back additional USDS whenever you would like. This enables you to always be able to actively manage your position.
    
The debt ceiling and borrow rate are determined by Sky ecosystem governance through a process of decentralised, community-driven on-chain voting. Borrow rate fees accumulate automatically per block and are added to the total debt. 

Opening a USDS borrow position is subject to liquidation risk if at any time the value of your sealed collateral drops below the required threshold and your position becomes undercollateralized. If this were to occur, the smart contract would automatically liquidate and auction your collateral. Any leftover collateral may be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/). `
  },
  {
    question: 'How is the borrow rate determined?',
    answer:
      'The debt ceiling and borrow rate are parameters determined by Sky ecosystem governance through a process of decentralised onchain voting. Borrow rate fees accumulate automatically per block and get added to the total debt.'
  },
  {
    question: 'What happens if my borrow position is liquidated?',
    answer:
      'Opening a USDS borrow position is subject to liquidation risk in the following scenario: If at any time the value of your sealed collateral drops below the required threshold and your position becomes undercollateralized, the smart contract automatically liquidates it and auctions your collateral. Any leftover collateral can be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/). '
  },
  {
    question: 'What’s the difference between Sky Token Rewards and Seal Rewards?',
    answer: `Sky Tokens Rewards are what you can access when you supply USDS to the Sky Token Rewards module of the decentralised Sky Protocol. Sky Token Rewards take the form of SKY governance tokens. 
      
Seal Rewards are what you access when you supply and seal MKR or SKY to the Seal Engine of the protocol. Seal Rewards currently take the form of USDS. Eventually, if approved by Sky ecosystem governance, Seal Rewards may also be available in the form of Sky Star tokens.`
  },
  {
    question: 'How does unsealing work?',
    answer: `When you supply MKR or SKY to the Seal Engine, a position is created and those tokens are sealed behind an exit fee. You can seal and unseal your tokens anytime. 
      
Unsealing requires the payment of an exit fee, which is a percentage of the total amount of tokens that you have sealed in that position. The fee is automatically subtracted from that total amount, and then burnt, removing the tokens from circulation. Your accumulated rewards are not affected.
      
The exit fee is a risk parameter managed and determined (regardless of position duration) by Sky ecosystem governance. The exit fee applies at unsealing, not at sealing, which means that it is determined the moment you unseal your MKR.`
  },
  {
    question: 'What does it mean to delegate my voting power?',
    answer: `When you hold MKR or SKY tokens, you maintain the right to participate in the process of Sky ecosystem governance voting. That means that you have the ability to contribute to the community-driven, decentralised ecosystem decision-making process, which occurs through onchain voting.
      
The voting power delegation feature of the Seal Engine of the Sky Protocol enables you to entrust your voting power to a delegate of your choosing, who can then vote in the Sky ecosystem governance process on your behalf. You can choose one delegate per sealed MKR or SKY position. If you want to entrust your MKR or SKY to two delegates using the Seal Engine, you will need to create two separate positions.
      
Delegates in receipt of token voting power can never directly access any tokens delegated to them, including sealed tokens. Throughout the delegation process, you always own and are in control of your sealed tokens, and you can change your delegate at any time.Sealing to delegate your voting power may be a useful option for governance token holders who have limited time to allocate to the process, who want to save on the cost of gas involved in voting on their own, and who also want to earn Seal Rewards.`
  },
  {
    question: 'Where can I learn about Sky ecosystem governance?',
    answer:
      'For a deep dive into the facets and checks and balances of Sky ecosystem governance, please refer to the [Sky Forum](https://forum.sky.money/), the [Sky Voting Portal](https://vote.makerdao.com/) and the [Sky Atlas](https://mips.makerdao.com/mips/details/MIP101)—the source of truth behind the Sky project, superseding and overriding all other competing rules or decisions.'
  }
];
