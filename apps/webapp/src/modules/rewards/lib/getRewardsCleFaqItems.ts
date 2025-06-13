import { isBaseChainId } from '@jetstreamgg/sky-utils';

export interface Item {
  question: string;
  answer: string;
  type?: 'restricted' | 'unrestricted';
}
export const getRewardsCleFaqItems = (chainId: number): Item[] => [
  ...mainnetFaqItems,
  ...(isBaseChainId(chainId) ? baseFaqItems : [])
  // TODO add arbitrum, optimism and unichain
];

const mainnetFaqItems = [
  {
    question: 'What is Chronicle?',
    answer:
      'Chronicle is the original oracle on Ethereum built within MakerDAO for the creation, management and maintenance of DAI. Today, [Chronicle’s decentralized oracle network](https://docs.chroniclelabs.org/Intro/network) secures the decentralized, non-custodial Sky Protocol, [Spark](https://spark.fi/), and many other decentralized finance (DeFi) and real world asset (RWA) protocols.'
  },
  {
    question: 'What are Chronicle Points, and how do they work?',
    answer: `When an eligible user supplies USDS to the Sky Token Rewards module of the Sky Protocol through the Sky.money web app (or some other platforms) they can access Chronicle Points as rewards. No minimum amount of USDS is required to access those points. 

    Chronicle Points might ultimately become claimable for Chronicle tokens (CLE) at a rate of 10 points for every 1 CLE token. The total supply of CLE tokens is anticipated to be 10 billion. Chronicle Points are emitted at a rate of 3.75 billion per year. Any future opportunities to convert Chronicle Points into CLE tokens would be managed independently by Chronicle’s own applications.
`
  },
  {
    question:
      'Is there a minimum requirement of USDS that I need to supply to the Sky Protocol to start collecting Chronicle Points?',
    answer: 'No minimum supply of USDS is required.'
  },
  {
    question: 'Where can I see the current total distribution of Chronicle Points?',
    answer:
      'Users can view the current distribution of Chronicle Points on the [Sky Ecosystem Dashboard](https://info.sky.money/rewards/0x10ab606b067c9c461d8893c47c7512472e19e2ce).'
  }
];

// Rewards on Base is coming soon
const baseFaqItems: Item[] = [];
