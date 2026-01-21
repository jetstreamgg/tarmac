export const getRewardsCleFaqItems = () => {
  const items = [
    {
      question: 'What is Chronicle?',
      answer:
        "Chronicle is the original oracle on Ethereum built within MakerDAO for the creation, management and maintenance of DAI. Today, [Chronicle's decentralized oracle network](https://docs.chroniclelabs.org/Intro/network) secures the decentralized, non-custodial Sky Protocol, [Spark](https://spark.fi/), and many other decentralized finance (DeFi) and real world asset (RWA) protocols.",
      index: 0
    },
    {
      question: 'What are Chronicle Points, and how do they work?',
      answer: `When an eligible user supplies USDS to the Sky Token Rewards module of the Sky Protocol through the Sky.money web app (or some other platforms), they can access Chronicle Points as rewards. No minimum amount of USDS is required to access those points.

Chronicle Points might ultimately become claimable for Chronicle tokens (CLE) at a rate of 10 points for every 1 CLE token. The total supply of CLE tokens is anticipated to be 10 billion. Chronicle Points are emitted at a rate of 3.75 billion per year. Any future opportunities to convert Chronicle Points into CLE tokens would be managed independently by Chronicle's own applications.`,
      index: 1
    },
    {
      question:
        'Is there a minimum requirement of USDS that I need to supply to the Sky Protocol to start collecting Chronicle Points?',
      answer: 'No minimum supply of USDS is required.',
      index: 2
    },
    {
      question: 'Where can I see the current total distribution of Chronicle Points?',
      answer:
        'You can view the current distribution of Chronicle Points on the [Sky Ecosystem Dashboard](https://info.sky.money/rewards/0x10ab606b067c9c461d8893c47c7512472e19e2ce).',
      index: 3
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
