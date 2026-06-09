export const getTetherSavingsFaqItems = () => {
  const items = [
    {
      question: 'What is the Tether Savings (sUSDT) Vault?',
      answer: `Tether Savings (sUSDT) is a non-custodial, permissionless stablecoin savings vault offered through the Sky.money web app. It is a first-party Sky product, managed by Sky using Spark infrastructure.

When you deposit USDT, you receive sUSDT vault shares representing your proportional ownership of the vault's assets. As the vault earns yield, your shares appreciate in value, allowing you to withdraw more USDT than you initially deposited. The savings rate is variable and set by Sky. Please see the [User Risk Documentation](https://docs.sky.money/user-risks) and [Terms of Use](https://docs.sky.money/legal-terms) for more information.`,
      index: 0
    },
    {
      question: "How is the Tether Savings Vault different from Sky's other Vaults?",
      answer:
        "Sky's other Vaults are curated by Sky on Morpho, a third-party lending protocol, and can carry exposure to a range of lending markets and collateral types. The Tether Savings Vault is a first-party Sky savings product, managed by Sky using Spark infrastructure rather than Morpho. It accepts USDT deposits and pays a single variable savings rate set by Sky.",
      index: 1
    },
    {
      question: 'How is the sUSDT savings rate determined?',
      answer:
        'The rate is variable and set by Sky. Sky sets the sUSDT savings rate against three inputs: profit-and-loss sustainability across the full deposit base, depositor composition, and on-chain borrow demand. Rates are adjusted over time to reflect what deployment yields can support, so the rate you see may change.',
      index: 2
    },
    {
      question: 'Can I withdraw my USDT at any time?',
      answer:
        'You can request a withdrawal at any time. Withdrawals are settled from the liquidity available for instant withdrawal; during periods of high demand, the amount immediately available may be limited until liquidity returns. Please see the [User Risk Documentation](https://docs.sky.money/user-risks) for more information.',
      index: 3
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
