export const getRewardsSpkFaqItems = () => {
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
    question: 'What is SPK?',
    answer:
      'SPK is the native governance and staking token of Spark. Designed with a long-term vision for sustainability, decentralization, and ecosystem alignment, SPK enables protocol governance, protocol security via staking, and reward distribution to participants.',
    index: 5
  }
];
