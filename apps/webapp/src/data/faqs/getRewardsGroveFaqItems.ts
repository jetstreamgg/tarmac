export const getRewardsGroveFaqItems = () => {
  const items = [
    {
      question: 'What is Grove?',
      answer:
        "Grove is a Sky Agent, one of the independent capital allocators operating within the Sky ecosystem. Supplying USDS through this module accrues GROVE, allowing you to participate in that operator's growth.",
      index: 0
    },
    {
      question: 'How are GROVE rewards calculated?',
      answer:
        'The protocol distributes a set amount of GROVE to the pool over time. Your share is proportional to your portion of the total USDS supplied, so the rate moves as the pool grows or shrinks. It is not a fixed APY. The current rate is shown live in the module. Sky.money does not control the issuance, determination, price fluctuations of the GROVE token, or the distribution mechanics of these rewards.',
      index: 1
    },
    {
      question: 'Where can I learn more about Grove’s token and security?',
      answer:
        'Official information about GROVE is published through [Grove’s documentation](https://docs.grove.finance/). No GROVE sale or migration runs through Sky.money. [Verify the token contract before interacting.](https://etherscan.io/token/0xb30fe1cf884b48a22a50d22a9282004f2c5e9406)',
      index: 2
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
