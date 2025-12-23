export const getSealFaqItems = () => {
  const items = [
    {
      question: 'What are Seal Rewards?',
      answer: `The Seal Engine is deprecated. Creation of new positions has been disabled. Management of existing positions remains available.

If you still have positions open, please exit them now.`,
      index: 0
    },
    {
      question: 'How are Seal Reward Rates determined?',
      answer:
        'Seal reward rates are determined by Sky Ecosystem Governance through a process of decentralized onchain voting.',
      index: 1
    },
    {
      question: 'How does the Seal Engine enable borrowing?',
      answer: `The Seal Engine is deprecated. Creation of new positions has been disabled. Management of existing positions remains available.

If you still have positions open, please exit them now.`,
      index: 2
    },
    {
      question: 'How is the borrow rate determined?',
      answer:
        'The debt ceiling and borrow rate are parameters determined by Sky Ecosystem Governance through a process of decentralized onchain voting. Borrow rate fees accumulate automatically per block and get added to the total debt.',
      index: 3
    },
    {
      question: 'What happens if my borrow position is liquidated?',
      answer:
        'Borrow positions are subject to liquidation risk in the following scenario: If at any time the value of your sealed collateral drops below the required threshold and your position becomes undercollateralized, the smart contract automatically liquidates it and auctions your collateral. Any leftover collateral can be claimed through the [Unified Auctions portal](https://unified-auctions.makerdao.com/).',
      index: 4
    },
    {
      question: 'How does unsealing work?',
      answer: `The Seal Engine is deprecated. Management of existing positions remains available. If you still have positions open, please exit them now. You can seal and unseal your tokens anytime.

Unsealing requires the payment of an exit fee, which is a percentage of the total amount of tokens that you have sealed in that position. The fee is automatically subtracted from that total amount, and then burnt, removing the tokens from circulation. Your accumulated rewards are not affected.

The exit fee is a risk parameter managed and determined (regardless of position duration) by Sky Ecosystem Governance. The exit fee applies at unsealing, not at sealing, which means that it is determined the moment you unseal your MKR.`,
      index: 5
    },
    {
      question: 'Where can I learn about Sky Ecosystem Governance?',
      answer:
        'For a deep dive into the facets and checks and balances of Sky Ecosystem Governance, please refer to the [Sky Forum](https://forum.sky.money/), the [Sky Voting Portal](https://vote.sky.money/) and the [Sky Atlas](https://sky-atlas.io/)—the source of truth behind the Sky project, superseding and overriding all other competing rules or decisions.',
      index: 6
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
