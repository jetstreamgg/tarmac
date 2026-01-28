export const getMorphoVaultFaqItems = () => {
  const items = [
    {
      question: 'Mock question',
      answer: 'Mock answer',
      index: 0
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
