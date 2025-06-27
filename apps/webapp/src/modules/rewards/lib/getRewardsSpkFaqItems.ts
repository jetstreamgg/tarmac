export interface Item {
  question: string;
  answer: string;
  type?: 'restricted' | 'unrestricted';
}
export const getRewardsSpkFaqItems = (): Item[] => mainnetFaqItems;

const mainnetFaqItems = [
  {
    question: 'What is Spark?',
    answer: 'Lorem ipsum'
  }
];
