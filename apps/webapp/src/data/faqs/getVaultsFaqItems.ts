export const getVaultsFaqItems = () => {
  const items = [
    {
      question: 'What are Vaults, and how do they work?',
      answer: `Vaults allow eligible users to earn yield on supported stablecoins by depositing into third-party managed strategies powered by Morpho. Each vault is managed by a professional curator who defines the strategy and risk profile for that vault.

When you deposit a supported stablecoin, you receive vault shares representing your proportional ownership of the vault's assets. The curator allocates deposited capital across multiple overcollateralized lending markets to generate yield. As interest accrues, your shares appreciate in value, allowing you to withdraw more than you initially deposited. Yield is automatically compounded—you do not need to manually claim or reinvest earnings.

Please see the [Terms of Use](https://docs.sky.money/legal-terms) for more information on third-party services.`,
      index: 0
    },
    {
      question: 'What Vaults are available?',
      answer: `Five vaults are available through the Sky.money web app:

• **USDS Flagship** — accepts USDS
• **USDT Savings** — accepts USDT
• **USDS Risk Capital** — accepts USDS
• **USDC Risk Capital** — accepts USDC
• **USDT Risk Capital** — accepts USDT

Each vault has a distinct strategy and risk profile determined by its curator. Yield rates are variable and differ across vaults.`,
      index: 1
    },
    {
      question: 'How do I deposit into a Vault?',
      answer: `Navigate to the Vaults section of the Sky.money web app and select a vault. Enter the amount you wish to deposit, review the transaction details, and confirm. If it is your first interaction with the vault, you may need to approve spending before confirming. Depending on the token and wallet state, the approval and deposit may be bundled into a single transaction.

Once confirmed, your funds are deposited into the vault strategy and begin earning yield.`,
      index: 2
    },
    {
      question: 'How do I withdraw from a Vault?',
      answer: `Select the vault you wish to withdraw from, switch to the Withdraw tab, enter the amount or select Max, and confirm the transaction. Funds are returned directly to your connected wallet.

Withdrawals are generally available at any time without lock-up periods, subject to available liquidity in the underlying lending markets.`,
      index: 3
    },
    {
      question: 'What is the difference between Vaults and the Sky Savings Rate?',
      answer: `The [Sky Savings Rate](#tooltip-sky-savings-rate) is a first-party feature of the Sky Protocol. It supports USDS only, offers a single strategy, and provides a variable rate determined by Sky Ecosystem Governance.

Vaults are powered by Morpho, a third-party lending protocol. They support multiple stablecoins (USDS, USDT, and USDC), offer variable strategies managed by professional curators, and have distinct risk and return profiles depending on the curator's allocation approach.`,
      index: 4
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
