export const getRewardsFaqItems = () => {
  const items = [...mainnetFaqItems];
  return items.sort((a, b) => a.index - b.index);
};

const mainnetFaqItems: {
  question: string;
  answer: string;
  index: number;
  type?: 'restricted' | 'unrestricted';
}[] = [
  {
    question: 'What are Sky Token Rewards, and how do they work?',
    answer:
      'When you supply  USDS to the Sky Token Rewards module of the Sky Protocol, you receive Sky Token Rewards over time in the form of SKY governance tokens. The USDS, as well as the rewards received, are supplied to a non-custodial smart contract that represents the USDS pool of assets. That means no intermediary has custody of your supplied assets.',
    index: 0
  },
  {
    question: 'How much USDS do I have to supply to accumulate Sky Token Rewards?',
    answer:
      'Eligible users can supply any amount of USDS to the Sky Token Rewards module of the decentralized Sky Protocol to begin accessing Sky Token Rewards. There is no minimum amount required. Eligible users can also withdraw their USDS at any time. With the Sky Protocol, you can receive rewards without giving up control of your supplied assets, as the Sky Token Rewards module is non-custodial.',
    index: 1
  },
  {
    question: 'How is the Sky Token Rewards rate calculated?',
    answer: `The Sky Token Rewards Rate is different for each type of token rewarded, and always fluctuates, determined by the following factors:

• The issuance rate of the token rewarded, which is determined by Sky Ecosystem Governance;

• The market price of the token rewarded; and

• The user's proportional supply within the total pool of assets linked to the Sky Token Rewards module.

Sky.money does not control the issuance, determination, or distribution of these rewards.`,
    index: 2
  },
  {
    question: 'How much does it cost to participate in Sky Token Rewards?',
    answer:
      'There is no fee to participate in the Sky Token Rewards feature of the  Sky Protocol; however, with each transaction, you will likely pay a transaction, or gas, fee for using the Ethereum blockchain network. That fee is neither controlled, imposed nor received by Sky.money or the Sky Protocol.',
    index: 3
  },
  {
    question: 'How do I claim my Sky Token Rewards?',
    answer:
      'To claim your Sky Token Rewards using the Sky.money web app, click on the Claim button in the Rewards feature of the app. You must claim all your Sky Token Rewards at once. It is not possible to claim partial rewards.',
    index: 4
  }
];
