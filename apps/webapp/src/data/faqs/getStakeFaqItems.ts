export const getStakeFaqItems = () => {
  const items = [
    {
      question: 'What are Staking Rewards?',
      answer:
        'Staking Rewards can be accessed when you supply SKY to the Staking Engine of the decentralized Sky Protocol. Currently, all Staking Rewards take the form of USDS. Your SKY, as well as any Staking Rewards that you accumulate, are supplied to a non-custodial smart contract, such that no intermediary ever takes custody of those tokens. Staking Reward rates are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.',
      index: 0
    },
    {
      question: 'How is the Staking Rewards rate determined?',
      answer:
        'The Staking Rewards rate is a parameter determined by Sky Ecosystem Governance through a process of decentralized, community-driven onchain voting.',
      index: 1
    },
    {
      question: 'What is the Staking Engine?',
      answer: `The Staking Engine is a feature of the decentralized Sky Protocol. It has replaced the Seal Engine, offering the same features but it has no exit fee and it only supports SKY tokens, not MKR. If you currently have one or more positions in the Seal Engine, you will need to manually exit and, if you choose, upgrade your MKR to SKY, and then supply your SKY to the Staking Engine. The process, via the Sky.money web app, makes manually exiting your current Seal positions and creating new positions in the Staking Engine as simple as possible.

**Overview of the Staking Engine**

When you supply SKY governance tokens to the Staking Engine using the Sky.money web app, you can access Staking Rewards and may also choose to create one or more positions, including positions that enable you to generate and borrow USDS against your supplied SKY and to delegate the voting power the SKY token provides. Here's a brief overview:

• Access Rewards. Supply SKY tokens to access Staking Rewards, initially in the form of USDS. Staking Reward rates are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.

• Borrow.  Borrow USDS against your supplied SKY. You can exit your borrow position at any time and withdraw or pay back USDS whenever you would like. The USDS Borrow Rate and debt ceiling are determined by Sky Ecosystem Governance through the process of decentralized onchain voting. Your total debt increases each block according to the Borrow Rate.

• Delegate. Transfer the voting power of your supplied SKY tokens to a recognized delegate or a contract that you own. Your chosen delegate can then participate in the Sky Ecosystem Governance voting process on your behalf. You can choose one delegate per position, meaning if you want to entrust your SKY to two different delegates using the Staking Engine, you will need to create two separate positions.

You may exit your Staking positions at any time; no exit fee applies. The Staking Reward rate and Borrow Rate are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.

Your SKY, as well as any Staking Rewards that you accumulate, are supplied to a non-custodial smart contract, such that no intermediary ever takes custody of those tokens. With Sky, you always remain in control of your assets.`,
      index: 2
    },
    {
      question: "What will happen to the MKR and/or SKY I've supplied to the Seal Engine?",
      answer: `If you currently have one or more positions in the Seal Engine, you will need to manually exit and, if you choose, upgrade your MKR to SKY, and then supply your SKY to the Staking Engine.  The process, via the Sky.money web app, makes manually exiting your current Seal positions and creating new positions in the Staking Engine as simple as possible.

For upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`,
      index: 3
    },
    {
      question: 'How does the Staking Engine enable borrowing?',
      answer: `The Staking Engine is a feature of the decentralized Sky Protocol. When you supply SKY tokens to the Staking Engine using the Sky.money web app, you can access Staking Rewards and may also choose to create one or more positions, including a position that enables you to generate and borrow USDS stablecoins against your supplied SKY.

You can exit your borrow position at any time—no exit fee applies—and withdraw or pay back USDS whenever you would like. 

The USDS Borrow Rate and debt ceiling are determined by Sky Ecosystem Governance through the process of decentralized onchain voting. Your total debt increases each block according to the Borrow Rate.

Please note that opening a USDS borrow position subjects you to liquidation risk if at any time the value of your supplied collateral drops below the required threshold (liquidation price) and your position becomes undercollateralized. If this were to occur, the smart contract would automatically liquidate and auction your collateral, and any leftover collateral may be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/).  

For more information, see the [User Risk Documentation](https://docs.sky.money/user-risks).`,
      index: 4
    },
    {
      question: 'How is the USDS Borrow Rate determined?',
      answer:
        'The USDS Borrow Rate and debt ceiling are parameters determined by Sky Ecosystem Governance through a process of decentralized, community-driven onchain voting.',
      index: 5
    },
    {
      question: 'Can I borrow USDS using ETH?',
      answer: `Yes, but only via [Spark](http://spark.fi)'s Borrow feature, not via the Sky.money web app. 

[Spark Borrow](https://spark.fi/borrow) enables you to borrow USDS stablecoins using various cryptocurrencies as collateral, including ETH. Spark is the very first Sky Star Agent (Star) and a top DeFi liquidity protocol. Stars are autonomous and independent decentralized projects within the larger Sky Ecosystem. For more information about the Borrow feature, you can review the [Spark Documentation](https://docs.spark.fi/user-guides/using-sparklend/borrow-dai-and-usds).`,
      index: 6
    },
    {
      question: 'What happens if my USDS borrow position is liquidated?',
      answer: `When you borrow USDS stablecoins against SKY tokens using the Staking Engine of the Sky Protocol or some other method, your position is subject to liquidation risk in the following scenario: If at any time the value of your supplied collateral drops below the required threshold (liquidation price), your position is undercollateralized and the smart contract will automatically liquidate it and auction your supplied collateral. Any leftover collateral can be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/).

For more information, see the [User Risk Documentation](https://docs.sky.money/user-risks).`,
      index: 7
    },
    {
      question: 'How do Sky liquidation auctions work?',
      answer: `The liquidation auctions of the Sky Protocol are automated processes that occur when a USDS or DAI borrow position becomes unsafe due to price fluctuations.  

A borrow position is subject to liquidation risk if at any time the value of the supplied collateral drops below the required threshold (liquidation price) and the position becomes undercollateralized. If this were to occur, the system would automatically liquidate and auction the collateral, and any leftover collateral may be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/).`,
      index: 8
    },
    {
      question: "What's the difference between Sky Token Rewards and Staking Rewards?",
      answer: `Sky Token Rewards are what you can access when you supply USDS stablecoins to the Sky Token Rewards module of the Sky Protocol. Sky Token Rewards currently take the form of SKY tokens. Both USDS and SKY are native tokens of the Sky Protocol.

Staking Rewards are what you can access when you supply SKY to the Staking Engine of the Sky Protocol. Staking Rewards currently take the form of USDS.`,
      index: 9
    },
    {
      question: 'How does exiting a Staking Engine position work?',
      answer:
        'You can exit your Staking Engine position(s) at any time—no exit fee applies—and draw or pay back USDS whenever you would like.',
      index: 10
    },
    {
      question: 'What does it mean to delegate my voting power?',
      answer: `When you hold SKY governance tokens, you may choose to participate in the decision-making process of Sky Ecosystem Governance. You can use your SKY to participate directly in governance through a system of decentralized onchain voting and/or to entrust your voting power to one or more delegates via the Sky Governance Voting portal or to a contract that you own. You can also use SKY to delegate your voting power via the Staking Engine of the Sky Protocol.

By supplying SKY to the Staking Engine, you can open a position, earn Staking Rewards, and also entrust your voting power to a delegate of your choosing, who can then participate in the Sky Ecosystem Governance voting process on your behalf. You can choose one delegate per position, meaning if you want to entrust your SKY to two different delegates using the Staking Engine, you will need to create two separate positions. 
Delegates in receipt of token voting power can never directly access any tokens delegated to them, including the SKY supplied to the Staking Engine. Throughout the delegation process, you always own and are in control of those tokens. You can also change your delegate at any time (subject to the Sky Protocol's rules that prevent double voting or misuse of delegated voting power).`,
      index: 11
    },
    {
      question: 'Where can I learn about Sky Ecosystem Governance?',
      answer:
        'For a deep dive into the facets and checks and balances of Sky Ecosystem Governance, please refer to the [Sky Forum](https://forum.sky.money/), the [Sky Governance Voting Portal](https://vote.makerdao.com/), and the [Sky Atlas](https://sky-atlas.powerhouse.io/). The Sky Atlas is the definitive rulebook of the Sky Ecosystem, as determined by Sky Ecosystem Governance.',
      index: 12
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
