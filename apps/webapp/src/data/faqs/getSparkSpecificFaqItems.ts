export const getSparkSpecificFaqItems = () => {
  const items = [
    {
      question: 'What is Spark?',
      answer:
        '[Spark.fi](https://Spark.fi), the very first Star in the Sky Ecosystem, is focused on building on USDS in the Ethereum and adjacent DeFi ecosystem. It is a gateway to the non-custodial Sky Protocol and, like all Sky Stars, an independent decentralized project. Spark offers users—especially USDS holders—products around saving, borrowing and liquidity provision. Spark.fi is more than just another DeFi app, it is the core liquidity and yield infrastructure layer for onchain finance.',
      index: 0
    },
    {
      question: 'What is the SPK token?',
      answer:
        'SPK is the native governance and staking token of [Spark.fi](https://Spark.fi). Designed with a long-term vision for sustainability, decentralization and ecosystem alignment, SPK enables protocol governance, protocol security via staking, and reward access to participants. For more information on Spark Governance, please see the [Spark Artifact](https://sky-atlas.powerhouse.io/A.AG1_Spark/1c1f2ff0-8d73-8157-a4b8-f568e2f09fe3%7C7896ed332638).',
      index: 1
    },
    {
      question: 'What is Spark Savings?',
      answer:
        '[Spark.fi](https://Spark.fi) enables users to easily deposit stablecoins into its Savings product and receive Savings USDS (sUSDS) tokens in return. The sUSDS tokens users receive represent their shares of USDS in the [Sky Savings Rate](#tooltip-sky-savings-rate). As savings accrue over time, the sUSDS increases in value. The Sky Savings Rate is set by Sky Ecosystem Governance through the process of decentralized onchain voting.',
      index: 2
    },
    {
      question: 'What is SparkLend?',
      answer:
        'SparkLend is a decentralized, non-custodial liquidity market protocol that powers the Spark Borrow product. It sources liquidity directly from Sky to provide the best borrow rates for USDS. Through [Spark.fi](https://Spark.fi), Spark Borrow users can participate as lenders or borrowers: lenders provide liquidity to the market to earn a passive income as their assets are lent out, while borrowers are able to borrow USDS in an overcollateralized and perpetual fashion.',
      index: 3
    },
    {
      question: 'What is the Spark Liquidity Layer?',
      answer:
        'The Spark Liquidity Layer directly and automatically provides USDS, sUSDS and USDC liquidity across networks and DeFi markets. This enables users to access the [Sky Savings Rate](#tooltip-sky-savings-rate) on their preferred network using sUSDS. Additionally, it allows Spark to automate liquidity provision into DeFi markets to optimize yield.  For more information, please see the [Spark Liquidity Layer documentation](https://docs.spark.fi/user-guides/spark-liquidity-layer).',
      index: 4
    },
    {
      question: 'Where can I learn more about Spark?',
      answer:
        'For a deep dive into [Spark.fi](https://Spark.fi), see the [Spark documentation](https://docs.spark.fi/dev/spk).',
      index: 5
    },
    {
      question:
        'Where can I find information related to logic for Spark, including its strategy and operations?',
      answer:
        "For complete information regarding Spark's logic and how it uses the Sky Primitives to operationalize its strategy, please see the [Spark Artifact](https://sky-atlas.powerhouse.io/A.AG1_Spark/1c1f2ff0-8d73-8157-a4b8-f568e2f09fe3%7C7896ed332638) within the [Sky Atlas](https://sky-atlas.powerhouse.io/A.0_Atlas_Preamble/4281ab93-ef4f-4974-988d-7dad149a693d).",
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
