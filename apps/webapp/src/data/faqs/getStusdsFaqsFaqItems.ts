export const getStusdsFaqsFaqItems = () => {
  const items = [
    {
      question: 'What is stUSDS?',
      answer: `stUSDS is a senior risk capital token designed for more expert users, who wish to engage with higher-risk modules. It is structured to absorb a greater share of system risk in exchange for the potential to capture a larger portion of protocol rewards; the asset mix of stUSDS can be viewed on the [Sky Ecosystem Dashboard](https://info.sky.money/stusds).

stUSDS funds and supports liquidity for SKY stakers, encouraging more participation in SKY governance by active token holders, delegators and voters, leading to a more secure Sky Ecosystem. Prospective users of stUSDS are encouraged to familiarize themselves and understand the risks associated with participating in a token that takes a senior risk position before participating.`,
      index: 0
    },
    {
      question: 'What is the stUSDS Rate, and how is it calculated?',
      answer: `The [stUSDS Rate](#tooltip-stusds-rate) is variable and calculated using the following formula:

stUSDS Rate = Utilization * (SKY Borrow Rate - stUSDS Accessibility Reward) + (1 - Utilization) * Sky Savings Rate

The rate is derived from the SKY Borrow Rate less the stUSDS Accessibility Reward on the utilized portion of your capital and the Sky Savings Rate on the unutilized portion. Utilization is the percent of funds in the stUSDS contract that are used to fund borrowing against staked SKY.

The SKY Borrow Rate is the current interest rate charged to SKY-backed borrowers and is dynamic and market-driven, based on the utilization of funds within the stUSDS contract.`,
      index: 1
    },
    {
      question: 'What is the SKY Borrow Rate?',
      answer:
        'The SKY Borrow Rate is the current interest rate charged to SKY-backed borrowers and is dynamic and market-driven, based on the utilization of funds within the stUSDS contract.',
      index: 2
    },
    {
      question: 'Does it cost anything to access the stUSDS Rate?',
      answer:
        'Accessing the [stUSDS Rate](#tooltip-stusds-rate) via the Sky.money web app is free and neither controlled, imposed nor received by Skybase International nor the Sky Protocol. However, any time you supply or withdraw assets to/from the stUSDS module of the Sky Protocol, you will incur a transaction fee, called a gas fee, for using the Ethereum blockchain network.',
      index: 3
    },
    {
      question: 'Is there a minimum amount of USDS I must supply to access stUSDS rewards?',
      answer:
        'No minimum supply amount is required to access the [stUSDS Rate](#tooltip-stusds-rate); however, there is a cap, set by Sky Ecosystem Governance, on how much USDS the stUSDS vault can accept. Withdrawals are available as long as the stUSDS pool has sufficient idle USDS. Since deposits fund SKY‑backed loans, withdrawal capacity depends on current [utilization](#tooltip-utilization): when most liquidity is lent out, withdrawals may be limited until repayments occur or liquidity returns.',
      index: 4
    },
    {
      question: 'What is the conversion rate for stUSDS?',
      answer:
        'The stUSDS conversion rate floats and generally increases over time as yield accrues. At launch it is typically 1.0 and rises as earnings accumulate. Loss events (e.g., liquidation shortfalls) reduce the exchange rate via a proportional haircut.',
      index: 5
    },
    {
      question: 'Can I supply/withdraw USDS to/from the stUSDS module anytime?',
      answer: `Generally, yes—deposits and withdrawals are designed to be available at any time, but there are a couple of caveats:

Liquidity availability: Withdrawals depend on the module having enough liquid USDS. If [utilization](#tooltip-utilization) is very high, you may need to wait for borrowers to repay or for liquidity to return, or withdraw partially.
Rate/fee changes: Sky Ecosystem Governance can update parameters (rates, caps) and may impose temporary safeguards during stress.`,
      index: 6
    },
    {
      question: 'Why are the risks and the rewards associated with stUSDS different to that of sUSDS?',
      answer:
        'stUSDS holders earn yield but also take on the risk of funding SKY‑backed borrowing. If a borrower’s staked SKY collateral is liquidated and the proceeds don’t fully cover the debt, the stUSDS vault absorbs the shortfall via a proportional haircut to the vault’s exchange rate (i.e., each stUSDS redeems for fewer USDS). This design ring‑fences losses to the stUSDS module, so the broader Sky Protocol is insulated from deficits arising in the SKY‑backed borrowing facility. So, sUSDS carries protocol-level risk but not borrower-shortfall risk, whereas stUSDS does bear that shortfall risk.',
      index: 7
    },
    {
      question: 'Can I trade stUSDS on the open market?',
      answer:
        'Yes, eligible users of the Sky.money web app can access the Trade feature to trade stUSDS via an API integration with the third-party decentralized exchange CoW Swap. stUSDS holders are also free to access any other protocol or exchange that supports stUSDS trading; however, users do so at their own risk. Sky.money is not responsible for any loss or damages incurred while using such third-party platforms. Please see the [User Risk Documentation](https://docs.sky.money/user-risks) for more information on third-party services.',
      index: 8
    }
  ];
  return items.sort((a, b) => a.index - b.index);
};
