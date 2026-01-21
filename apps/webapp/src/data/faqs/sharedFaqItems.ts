export const L2GeneralFaqItems = [
  {
    question: 'What are Layer 2 networks, and how do they benefit users?',
    answer: `Layer 2 (L2) networks are blockchain scalability solutions built on top of existing blockchains (Layer 1 or L1 networks). While L2s exist across several blockchains, they are most commonly used with the Ethereum blockchain, where they are designed to solve two major problems: high transaction (gas) fees and slow transaction speeds, which can hinder scalability.

L2 solutions usually work by processing transactions on their own blockchain, and then bundling those transactions and submitting them back to the underlying L1 as a single transaction for final validation, which drastically increases throughput.

Moving assets between L1 and L2 networks requires specialized protocols called bridges. While bridges can be designed to connect any two blockchain networks, L2 networks operate on top of L1s, inheriting their security, while delivering improved efficiency.

L2s used with Ethereum not only offer users lower fees and faster speeds (transactions can be near-instant), they can enable users to transact using the wallets and tools they are already familiar with. There is a tradeoff, however, as users bridging their assets between L1 and L2 networks generally must pay a transaction fee. For users making multiple transactions, the savings may outweigh that cost and you must use your own discretion. Also, L1 networks may provide stronger security guarantees compared to L2s, which often rely on centralized components and actors, which could potentially introduce points of failure.`,
    index: 0
  },
  {
    question: 'What can I do with my assets once they are linked to a supported L2 network?',
    answer:
      'On many supported Layer 2 (L2) networks, you can perform the same types of transactions as on Ethereum Mainnet—i.e., trade tokens, use DeFi applications (dApps), etc.—but with reduced fees and faster transaction speeds. Many popular dApps have L2 versions, though not all are available on every L2. Please note that some features of Sky.money or the Sky Protocol are not available on L2s.',
    index: 1
  }
];

export const baseFaqItems = [
  {
    question: 'What is the Base L2 Solution?',
    answer: `Base is a Coinbase-developed Layer 2 (L2) network built on Ethereum that provides faster and cheaper transactions while maintaining Ethereum’s security.
SkyLink is Sky Ecosystem’s multichain solution connecting USDS, SKY and other Sky Ecosystem tokens from the Ethereum Mainnet to other chains and L2 protocols.`,
    index: 0
  }
];

export const arbitrumFaqItems = [
  {
    question: 'What is the Arbitrum L2 Solution?',
    answer: `Arbitrum is a Layer 2 (L2) scaling solution designed to improve the scalability and efficiency of Ethereum. Specifically, it is an Optimistic rollup built on top of the Ethereum blockchain, relying on Ethereum for security and consensus. Although it functions like an independent network for users interacting with it, Arbitrum is not a standalone Layer 1 (L1) blockchain.

SkyLink is Sky Ecosystem’s multichain solution connecting USDS, SKY and other Sky Ecosystem tokens from the Ethereum Mainnet to other chains and L2 protocols.`,
    index: 0
  }
];

export const optimismFaqItems = [
  {
    question: 'What is the Optimism L2 Solution?',
    answer: `Optimism is a Layer 2 (L2) scaling solution designed to improve the scalability and efficiency of Ethereum. Specifically, it uses optimistic rollups, which enable transactions to be processed offchain and then submitted to Ethereum in a compressed form to complete transactions more quickly and at a lower cost than on Ethereum Mainnet.

SkyLink is Sky Ecosystem’s multichain solution connecting USDS, SKY and other Sky Ecosystem tokens from the Ethereum Mainnet to other chains and L2 protocols.`,
    index: 0
  }
];

export const unichainFaqItems = [
  {
    question: 'What is the Unichain L2 Solution?',
    answer: `Unichain is a Layer 2 (L2) scaling solution designed by Uniswap Labs to improve the scalability and efficiency of Ethereum. Specifically designed to optimize DeFi applications, it uses optimistic rollups, which enable transactions to be processed offchain and then submitted to Ethereum in a compressed form to complete transactions more quickly and at a lower cost than on Ethereum Mainnet.

SkyLink is Sky Ecosystem’s multichain solution connecting USDS, SKY and other Sky Ecosystem tokens from the Ethereum Mainnet to other chains and L2 protocols.`,
    index: 0
  }
];
