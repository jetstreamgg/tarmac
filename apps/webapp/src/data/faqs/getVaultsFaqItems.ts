export const getVaultsFaqItems = () => {
  const items = [
    {
      question: 'What are Vaults, and how do they work?',
      answer: `Vaults allow to earn yield on supported stablecoins by depositing into strategies curated by Sky on Morpho, a third-party lending protocol. Sky, as vault curator, defines the strategy and risk profile for each vault.

When you deposit a supported stablecoin into a vault, you receive vault shares representing your proportional ownership of the vault's assets. Sky allocates deposited capital across overcollateralized lending markets to generate yield. As interest accrues from lending activities, your shares appreciate in value, allowing you to withdraw more than you initially deposited.

Vault yields are variable and depend on market conditions, borrower demand, and the allocation strategy. Yield from lending activities is automatically compounded—you do not need to manually claim or reinvest lending earnings. Merkl rewards, which may be distributed on top of native vault yield, accrue based on your activity but are not automatically compounded and must be claimed separately within Sky app or via [Merkl](https://merkl.xyz/). Please see the [User Risk Documentation](https://docs.sky.money/user-risks) and [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.`,
      index: 0
    },
    {
      question: 'What are the differences between vaults?',
      answer: `Sky curates three different vault types: Savings, Flagship and Risk Capital vaults.

* Savings vault, exposed only to the sUSDS lending market, minimizing risk from crypto asset volatility. The most conservative option.

* Flagship vault, balances risk and yield by adding exposure to stUSDS, cbBTC, wstETH, and WETH markets. 80% of deposited funds are held as sUSDS, which provides a significant liquidity buffer while earning the Sky Savings Rate.

* Risk Capital vaults, allocated exclusively to stUSDS markets, which carry exposure to SKY token price volatility. The highest-yielding vaults, but also the highest risk in terms of availble liquidity.

Risk Capital vaults accept different stablecoins as deposits (USDC, USDT), while all the others accept only USDS.`,
      index: 1
    },
    {
      question: 'What is the difference between Vaults and the Sky Savings Rate?',
      answer: `The [Sky Savings Rate](#tooltip-sky-savings-rate) is a first-party feature of the Sky Protocol. It supports USDS only, offers a single strategy, and provides a variable rate determined by Sky Ecosystem Governance.

Vaults are curated by Sky on Morpho, a third-party lending protocol. They support multiple stablecoins (USDS, USDT, and USDC), offer variable strategies defined by Sky as curator, and have distinct risk and return profiles depending on the allocation approach.`,
      index: 2
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
