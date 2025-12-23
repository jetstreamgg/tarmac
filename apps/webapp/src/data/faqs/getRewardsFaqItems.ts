export const getRewardsFaqItems = () => {
  const items = [
    {
      question: 'What are Sky Token Rewards, and how do they work?',
      answer:
        'When you supply USDS to the Sky Token Rewards module of the Sky Protocol, you receive Sky Token Rewards over time. The USDS, as well as the rewards received, are supplied to a non-custodial smart contract that represents the USDS pool of assets. That means no intermediary has custody of your supplied assets.',
      index: 0
    },
    {
      question: 'What tokens can I use to access Sky Token Rewards?',
      answer: 'Only USDS can be used to access Sky Token Rewards.',
      index: 1
    },
    {
      question: 'How much USDS do I have to supply to accumulate Sky Token Rewards?',
      answer:
        'Eligible users can supply any amount of USDS to the Sky Token Rewards module of the decentralized Sky Protocol to begin accessing Sky Token Rewards. There is no minimum amount required. Eligible users can also withdraw their USDS at any time. With the Sky Protocol, you can receive rewards without giving up control of your supplied assets, as the Sky Token Rewards module is non-custodial.',
      index: 2
    },
    {
      question: 'How are Sky Token Rewards rates calculated?',
      answer: `The [Sky Token Rewards Rate](#tooltip-rewards-rate) is different for each type of token rewarded, and always fluctuates, determined by the following factors:

• The issuance rate of the token rewarded, which is determined by Sky Ecosystem Governance;

• The market price of the token rewarded; and

• The user's proportional supply within the total pool of assets linked to the Sky Token Rewards module.

Sky.money does not control the issuance, determination, or distribution of these rewards.`,
      index: 3
    },
    {
      question: 'How are Sky Token Rewards funded?',
      answer: `Users can supply USDS to the Sky Token Rewards module of the Sky Protocol to receive rewards in the form of SKY tokens, Sky Star Agent tokens, and Chronicle points. Sky Protocol reward mechanisms are designed to balance incentives for users while maintaining sustainability and minimizing unnecessary inflation. Rewards are funded as follows:

• **SKY as Staking Rewards:** SKY rewards distributed to SKY stakers are funded by the Sky Protocol's treasury and originate from buybacks executed by the Smart Burn Engine. The specific sources, routing, and distribution of rewards are determined by Sky Ecosystem Governance and may change over time.

• **Star Agen tokens as rewards:** Currently, Star Agent token rewards distributed to SKY stakers are funded using distributions to Sky from the investments in those Stars. This is not inflationary for the Sky Protocol, as these are external tokens acquired through investment.

• **Chronicle Points as rewards:** USDS suppliers can opt to receive Chronicle Points, which might ultimately become claimable for Chronicle tokens (CLE) at a rate of 10 points for every 1 CLE token. The total supply of CLE tokens is anticipated to be 10 billion. Chronicle Points are emitted at a rate of 3.75 billion per year. Any future opportunities to convert Chronicle Points into CLE tokens would be managed independently by Chronicle's own applications.`,
      index: 4
    },
    {
      question: 'How much does it cost to participate in Sky Token Rewards?',
      answer:
        'There is no fee to participate in the Sky Token Rewards feature of the Sky Protocol; however, with each transaction, you will likely pay a transaction (gas) fee for using the Ethereum blockchain network. That fee is neither controlled, imposed nor received by Sky.money or the Sky Protocol.',
      index: 5
    },
    {
      question: 'How do I claim my Sky Token Rewards?',
      answer:
        'To claim your Sky Token Rewards using the Sky.money web app, click on the Claim button in the Rewards feature of the app. You must claim all your Sky Token Rewards at once. It is not possible to claim partial rewards.',
      index: 6
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
