export const getStakeFaqItems = () => {
  const items = [
    {
      question: 'What is the Staking Engine?',
      answer: `The Staking Engine is a feature of the decentralized Sky Protocol. When you stake SKY, you can access Staking Rewards and may also choose to create one or more positions, including positions that enable you to generate and [borrow](#tooltip-borrow) USDS against your supplied SKY and to delegate the voting power the SKY token provides. Note that the Staking Engine has replaced the Seal Engine, offering the same features but only supports SKY tokens not MKR.

You may manage your Staking positions at any time. Staking Reward parameters and the Borrow Rate are determined by Sky Ecosystem Governance through the process of decentralized onchain voting. Your SKY, as well as any Staking Rewards that you accumulate, are supplied to a non-custodial smart contract, such that no intermediary ever takes custody of those tokens. With Sky, you always remain in control of your assets.`,
      index: 0
    },
    {
      question: 'What are Staking Rewards?',
      answer:
        'Staking Rewards can be accessed when you stake SKY to the Staking Engine of the decentralized Sky Protocol. Your SKY, as well as any Staking Rewards that you accumulate, are supplied to a non-custodial smart contract, such that no intermediary ever takes custody of those tokens. Staking Reward rates are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.',
      index: 1
    },
    {
      question: 'How are Staking Rewards funded?',
      answer: `When you stake SKY tokens using the Sky.money web app, you can access Staking Rewards in the form of SKY or Sky Star tokens. You may also choose to create one or more positions, including positions that enable you to generate and borrow USDS against your supplied SKY and to delegate the voting power the SKY token provides. Rewards are funded as follows:

• **SKY as Staking Rewards:** SKY rewards distributed to SKY stakers are funded by the Sky Protocol’s treasury and originate from buybacks executed by the Smart Burn Engine. The specific sources, routing, and distribution of rewards are determined by governance and may change over time.

• **Star Agent tokens as rewards:** Currently, Star Agent token rewards distributed to SKY stakers are funded using distributions to Sky from the Stars. This is not inflationary for the Sky Protocol, as these are external tokens acquired through investment.

• **SKY-backed borrowing:** The capital for SKY-backed borrowing is provided by Expert Module users who deposit USDS to that module to access the stUSDS Rate and receive stUSDS in return. The stUSDS tokens serve as a digital record of their USDS interaction with the stUSDS module and any change to the value of their position. The rewards distributed to stUSDS holders come from the interest paid by SKY borrowers (the SKY Borrow Rate) and protocol revenues.`,
      index: 2
    },
    {
      question:
        'Is there a minimum requirement of SKY that I need to supply to the Staking Engine to access Staking Rewards?',
      answer: 'No minimum supply of SKY is required.',
      index: 3
    },
    {
      question: 'How are Staking Rewards rates determined?',
      answer: `[Staking Rewards Rates (SRRs)](#tooltip-staking-rewards-rates-srrs) are variable and may fluctuate.

Staking Rewards rates are determined by: 1) the current issuance parameter of rewards (how many rewards are distributed, as determined by Sky Ecosystem Governance), and 2) the current market price of SKY tokens at the time of calculation.
The rates shown in Sky.money are estimated annual rates that can change over time due to both Sky Ecosystem Governance decisions on reward issuance and fluctuations in the market price of SKY.

Rates are updated using data from a third-party provider (i.e., [BlockAnalitica](https://blockanalitica.com/)). Therefore, rates shown do not guarantee future results.`,
      index: 4
    },
    {
      question: 'How do I change my Staking Reward selection?',
      answer: `Go to the Stake & Borrow widget in the Sky.money app There, you will see your Staking position(s) and your reward choice for each position.

If you currently receive USDS as your reward, you will see a message informing you that USDS rewards have been disabled and SKY has been added as a Staking Reward option. If you do not currently receive USDS as a reward, you will not see this message.

To change your reward selection quickly, bypassing the borrow and delegate steps, click on the drop-down beside your reward ticker symbol (e.g., USDS, SPK) to see the current options, including SKY. After making your selection, the app will fast-forward you to the last step of managing your Staking position, where you can confirm the change to activate your updated reward choice.

If you would rather manage your position(s) in the typical way, you would go to the Stake & Borrow widget and click on Manage Position to be taken through all of the Staking steps. At Step 2, you can change your reward choice. In the list of reward options, you’ll notice that USDS is shown, though it is disabled and the USDS reward rate is set to zero. Here, you can select your new reward.`,
      index: 5
    },
    {
      question:
        'Now that USDS is disabled as a Staking Reward option, do I have to change my reward selection?',
      answer:
        'No. However, you are encouraged to claim your existing rewards and select a new reward in order to take advantage of all Sky Ecosystem has to offer. Choosing a new reward type ensures that your staking position continues to accrue rewards. Since the USDS reward parameter is set to zero, you will not receive additional USDS rewards.',
      index: 6
    },
    {
      question:
        'Now that USDS is disabled as a Staking Reward option, do I have to unstake before changing my Staking Reward selection?',
      answer: 'No. You can change your Staking Reward selection without unstaking your SKY.',
      index: 7
    },
    {
      question: 'Do I need to repay the USDS that I’ve borrowed before changing my Staking Reward selection?',
      answer: 'No. You can change your Staking Reward selection without repaying the USDS you’ve borrowed.',
      index: 8
    },
    {
      question: 'Is there a deadline for claiming my USDS Staking Rewards?',
      answer: `No. While USDS rewards are disabled as a Staking Reward option, and the USDS rate set to zero, the pool of USDS will remain forever so that you can claim your rewards anytime.

When you stake SKY governance tokens to the Staking Engine, you can:

• **Access Rewards.** Supply SKY tokens to access Staking Rewards. Staking Reward rates are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.

• **Borrow.** Borrow USDS against your supplied SKY. You can exit your borrow position at any time and withdraw or pay back USDS whenever you would like. The USDS [Borrow Rate](#tooltip-borrow-rate) and [debt ceiling](#tooltip-debt-ceiling) are determined by Sky Ecosystem Governance through the process of decentralized onchain voting. Your total debt increases each block according to the Borrow Rate.

• **Delegate.** Transfer the voting power of your supplied SKY tokens to a recognized delegate or a contract that you own. Your chosen delegate can then participate in the Sky Ecosystem Governance voting process on your behalf. You can choose one delegate per position, meaning if you want to entrust your SKY to two different delegates using the Staking Engine, you will need to create two separate positions.

You may exit your Staking positions at any time; no exit fee applies. Staking Reward rates and the Borrow Rate are determined by Sky Ecosystem Governance through the process of decentralized onchain voting.

Your SKY, as well as any Staking Rewards that you accumulate, are supplied to a non-custodial smart contract, such that no intermediary ever takes custody of those tokens. With Sky, you always remain in control of your assets.`,
      index: 9
    },
    {
      question: "What will happen to the MKR and/or SKY I've supplied to the Seal Engine?",
      answer: `If you have one or more positions in the Seal Engine, you can migrate to the Staking Engine. Your sealed MKR will be upgraded to SKY during the Seal to Staking migration process. The process via the Sky.money web app makes manually exiting your Seal positions and creating new positions in the Staking Engine as simple as possible.

For MKR to SKY upgrade details and step-by-step upgrade instructions, please visit the [MKR to SKY Upgrade Hub](https://upgrademkrtosky.sky.money).`,
      index: 10
    },
    {
      question: 'How does the Staking Engine enable borrowing?',
      answer: `The Staking Engine is a feature of the decentralized Sky Protocol. When you supply SKY tokens to the Staking Engine using the Sky.money web app, you can access Staking Rewards and may also choose to create one or more positions, including a position that enables you to generate and [borrow](#tooltip-borrow) USDS stablecoins against your supplied SKY.

You can manage your borrow position whenever you’d like. You can decide to pay back all of your debt, withdraw your staked SKY, and claim some or all of your rewards at any time. Your SKY and claimed rewards are then released from the Staking Engine smart contract back to your connected wallet.

The USDS Borrow Rate and [debt ceiling](#tooltip-debt-ceiling) are determined by Sky Ecosystem Governance through the process of decentralized onchain voting. Your total debt increases each block according to the [Borrow Rate](#tooltip-borrow-rate).

Please note that opening a USDS borrow position subjects you to liquidation risk if at any time the value of your supplied collateral drops below the required threshold ([liquidation price](#tooltip-liquidation-price-staking)) and your position becomes undercollateralized. If this were to occur, the smart contract would automatically liquidate and auction your collateral, and any leftover collateral may be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/).

For more information, see the [User Risk Documentation](https://docs.sky.money/user-risks).`,
      index: 11
    },
    {
      question: 'How is the USDS Borrow Rate determined?',
      answer:
        'The USDS [Borrow Rate](#tooltip-borrow-rate) and [debt ceiling](#tooltip-debt-ceiling) are parameters determined by Sky Ecosystem Governance through a process of decentralized, community-driven onchain voting.',
      index: 12
    },
    {
      question: 'Can I borrow USDS using ETH?',
      answer:
        'Yes. For example, you can do so via the Borrow feature of [Spark](https://Spark.fi), but not via the Sky.money web app. Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.',
      index: 13
    },
    {
      question: 'What happens if my USDS borrow position is liquidated?',
      answer: `When you [borrow](#tooltip-borrow) USDS stablecoins against SKY tokens using the Staking Engine of the Sky Protocol or some other method, your position is subject to liquidation risk in the following scenario: If at any time the value of your supplied collateral drops below the required threshold ([liquidation price](#tooltip-liquidation-price-staking)), your position is undercollateralized. That means it will be liquidated and your supplied collateral will be auctioned, coordinated through Sky Ecosystem Governance channels. Any leftover collateral can be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/)

For more information, see the [User Risk Documentation](https://docs.sky.money/user-risks).`,
      index: 14
    },
    {
      question: 'How do Sky liquidation auctions work?',
      answer: `The liquidation auctions of the Sky Protocol are automated processes that occur when a USDS or DAI [borrow](#tooltip-borrow) position becomes unsafe due to price fluctuations.

A borrow position is subject to liquidation risk if at any time the value of the supplied collateral drops below the required threshold ([liquidation price](#tooltip-liquidation-price-staking)) and the position becomes undercollateralized. If this were to occur, the system would automatically liquidate and auction the collateral, and any leftover collateral may be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/).`,
      index: 15
    },
    {
      question: "What's the difference between Sky Token Rewards and Staking Rewards?",
      answer:
        'Sky Token Rewards are what you can access when you supply USDS stablecoins to the Sky Token Rewards module of the Sky Protocol. Staking Rewards are what you can access when you stake SKY to the Staking Engine of the Sky Protocol.',
      index: 16
    },
    {
      question: 'What does it mean to delegate my voting power?',
      answer: `When you hold SKY governance tokens, you may choose to participate in the decision-making process of Sky Ecosystem Governance. You can use your SKY to participate directly in governance through a system of decentralized onchain voting and/or to entrust your voting power to one or more delegates via the [Sky Governance Voting portal](https://vote.sky.money/) or to a contract that you own. You can also use SKY to delegate your voting power via the Staking Engine of the Sky Protocol.

By supplying SKY to the Staking Engine, you can open a position, access Staking Rewards, and also entrust your voting power to a delegate of your choosing, who can then participate in the Sky Ecosystem Governance voting process on your behalf. You can choose one delegate per position, meaning if you want to entrust your SKY to two different delegates using the Staking Engine, you will need to create two separate positions.

Delegates granted voting power can never directly access any tokens delegated to them, including the SKY supplied to the Staking Engine. Throughout the delegation process, you always own and are in control of those tokens. You can also change your delegate at any time (subject to Sky Protocol rules that prevent double voting or misuse of delegated voting power).`,
      index: 17
    },
    {
      question: 'Where can I learn about Sky Ecosystem Governance?',
      answer:
        'For a deep dive into the facets and checks and balances of Sky Ecosystem Governance, please refer to the [Sky Forum](https://forum.sky.money/), the [Sky Governance Voting Portal](https://vote.sky.money/), and the [Sky Atlas](https://sky-atlas.io/). The Sky Atlas is the definitive rulebook of Sky Ecosystem, as determined by Sky Ecosystem Governance.',
      index: 18
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
