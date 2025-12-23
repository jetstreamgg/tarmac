export const getBundledTransactionsFaqItems = () => {
  const items = [
    {
      question: 'What are EIP-7702 batch transactions, and how do they work?',
      answer: `EIP-7702 is a formal Ethereum Improvement Proposal that introduces native batch transactions. Batch transactions enable users to bundle multiple onchain calls (e.g., token approval and upgrade, token approval and savings supply, etc.) into one atomic operation.

Wallets implement EIP-7702 via delegate contracts that handle bundling, validation, gas estimation, and signature flow on behalf of dApps. Please note, however, that all security checks, user confirmations, and error handling are managed by your chosen wallet's delegate contract.

As outlined in the [Terms of Use](https://docs.sky.money/legal-terms), your use of a non-custodial digital wallet—including wallets supporting EIP-7702 and smart account functionality—is governed by the terms of service of your third-party wallet provider. We do not control or take responsibility for the security, functionality, or behavior of third-party wallets, including their handling of bundled transactions or delegate contracts. To help ensure a secure and transparent experience, please be certain you are using a trusted and up-to-date wallet before proceeding.

By adopting EIP-7702, Sky.money delivers a one-click, gas-optimized experience that aligns with the best practices of the broader Ethereum ecosystem, while avoiding any additional risks associated with low-level transaction assembly or bundler contract implementation.`,
      index: 0
    },
    {
      question: 'How do I opt in or out of bundled transactions?',
      answer: `EIP-7702 bundled transactions are enabled by default, as they simplify the user experience and reduce gas costs. You can opt out of bundled transactions manually by toggling off where indicated in the feature widget flow or in the main navigation bar in the top right corner of the app.

When bundled transactions are toggled off, you will need to confirm two separate transactions, as you did prior to implementation of the bundled transaction option, instead of only one.`,
      index: 1
    },
    {
      question: 'How do I know if my wallet is compatible with EIP-7702 bundled transactions?',
      answer: `On first use, if your connected wallet supports EIP-7702 functionality, it will ask if you would like to use a Smart Account, which accommodates features such as bundled transactions. You will also be shown some of the benefits of opting for a Smart Account. On MetaMask, for example, those benefits include:

• Faster transactions and lower [gas fees](#tooltip-gas-fee).
• The ability to pay network fees with any token in your wallet.
• The ability to keep the same wallet address and turn the functionality on or off any time.

If your connected wallet doesn't support EIP-7702, you will not be able to use the bundled transactions option with that wallet.`,
      index: 2
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
