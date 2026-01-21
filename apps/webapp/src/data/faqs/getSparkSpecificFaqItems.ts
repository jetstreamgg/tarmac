export const getSparkSpecificFaqItems = () => {
  const items = [
    {
      question: 'What is Spark?',
      answer:
        'Spark is the very first Star Agent in Sky Ecosystem. It is focused on building on USDS in the Ethereum and adjacent DeFi ecosystem. Like all Sky Star Agents, Spark is an independent decentralized project. [Spark.fi](https://spark.fi/) is a gateway to the non-custodial Sky Protocol, offering users—especially USDS holders—products around saving, borrowing and liquidity provision. More than just another DeFi app, Spark.fi is the core liquidity and yield infrastructure layer for onchain finance. Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.',
      index: 0
    },
    {
      question: 'What is the SPK token?',
      answer:
        'SPK is the native governance and staking token of [Spark.fi](https://spark.fi/). Designed with a long-term vision for sustainability, decentralization and ecosystem alignment, SPK enables protocol governance, protocol security via staking, and reward access to participants. For more information on Spark Governance, please see [Spark Governance documentation](https://docs.spark.fi/governance/). Please review the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.',
      index: 1
    },
    {
      question: 'What is Spark Savings?',
      answer:
        '[Spark.fi](https://spark.fi/) enables users to easily deposit stablecoins into its Savings product and receive sUSDS (Savings sUSDS) tokens in return. The sUSDS tokens users receive represent their shares of USDS in the Sky Savings Rate. As savings accrue over time, the sUSDS increases in value. The Sky Savings Rate is set by Sky Ecosystem Governance through the process of decentralized onchain voting. Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.',
      index: 2
    },
    {
      question: 'What is SparkLend?',
      answer:
        "SparkLend is a decentralized, non-custodial liquidity market protocol that powers [Spark.fi](https://spark.fi/)'s Spark Borrow product. It sources liquidity directly from Sky to provide the best borrow rates for USDS. Through Spark Borrow, users can participate as lenders or borrowers: lenders provide liquidity to the market to earn a passive income as their assets are lent out, while borrowers are able to borrow in an overcollateralized and perpetual fashion. Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.",
      index: 3
    },
    {
      question: 'What is the Spark Liquidity Layer?',
      answer:
        'The Spark Liquidity Layer directly and automatically provides USDS, sUSDS and USDC liquidity across networks and DeFi markets. This enables users to access the Sky Savings Rate on their preferred network using sUSDS. Additionally, it allows Spark to automate liquidity provision into DeFi markets to optimize yield. Please see [Spark Documentation](https://docs.spark.fi/user-guides/spark-liquidity-layer) and [Spark Liquidity Layer documentation](https://docs.spark.fi/user-guides/spark-liquidity-layer) for details. For more information on third-party services, please see the [Terms of Use](https://docs.sky.money/legal-terms).',
      index: 4
    },
    {
      question: 'Where can I learn more about Spark?',
      answer:
        'For a deep dive into Spark.fi, see [Spark Documentation](https://docs.spark.fi/user-guides/spark-liquidity-layer). Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.',
      index: 5
    },
    {
      question:
        'Where can I find information related to logic for Spark, including its strategy and operations?',
      answer:
        "For complete information regarding Spark's logic and how it uses the Sky Primitives to operationalize its strategy, please see the [Sky Atlas](https://sky-atlas.io/). Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.",
      index: 6
    },
    {
      question:
        'Is there a minimum requirement of USDS that I need to supply to the Sky Protocol to access SPK as a Sky Token Reward?',
      answer: 'No minimum supply of USDS is required.',
      index: 7
    },
    {
      question:
        'Is there a minimum requirement of SKY that I need to supply to the Staking Engine to access SPK as a Staking Reward?',
      answer: 'No minimum supply of SKY is required.',
      index: 8
    },
    {
      question: 'Where can I find the Spark Analytics Dashboard?',
      answer:
        'View the most comprehensive information and data about Spark on the [Spark Analytics Dashboard](https://spark.blockanalitica.com/).',
      index: 9
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
