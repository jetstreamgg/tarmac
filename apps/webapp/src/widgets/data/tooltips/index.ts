import { getLegacyTooltipById } from './legacy-tooltips';

export interface Tooltip {
  id: string;
  title: string;
  tooltip: string;
}

export const tooltips: Tooltip[] = [
  {
    id: 'safewallet',
    title: 'Safe[Wallet]',
    tooltip: `Note that Sky.money is listed as a Safe[Wallet] Safe App, meaning you can open the app directly through your Safe[Wallet] interface. Sky.money is not responsible for any loss or damages incurred while using such third-party platforms, and you should familiarize yourself with the risks of doing so. Please see the [Terms of Use](https://docs.sky.money/legal-terms).

Open Safe[Wallet]`
  },
  {
    id: 'stusds-rate',
    title: 'stUSDS Rate',
    tooltip:
      'stUSDS yield is generated dynamically through SKY-backed lending within Sky Protocol and is dependent on the Utilization Rate. Sky.money does not control, set, or guarantee the rate. All yields are variable.'
  },
  {
    id: 'utilization',
    title: 'Utilization',
    tooltip:
      'Utilization is the percentage of funds in the stUSDS contract that are used to fund borrowing against staked SKY.'
  },
  {
    id: 'maximum-capacity',
    title: 'Maximum capacity',
    tooltip: 'The governance-set limit on how much USDS the vault will accept.'
  },
  {
    id: 'stusds-debt-ceiling',
    title: 'stUSDS debt ceiling',
    tooltip:
      'The stUSDS debt ceiling is the governance‑set maximum amount of USDS that can be lent from the stUSDS pool to SKY‑backed borrowers. It caps credit exposure, independent of the current pool balance. Actual borrowing at any time is limited by both available idle liquidity and the debt ceiling.'
  },
  {
    id: 'available-liquidity',
    title: 'Available liquidity',
    tooltip:
      'The amount of USDS currently idle in the stUSDS pool and available for immediate withdrawal or new borrowing. Higher liquidity generally means smoother and more efficient transactions.'
  },
  {
    id: 'remaining-capacity',
    title: 'Remaining capacity',
    tooltip:
      'Remaining capacity is the amount of additional USDS that can be supplied until the maximum capacity is reached.'
  },
  {
    id: 'total-staking-engine-debt',
    title: 'Total Staking Engine debt',
    tooltip: 'The current sum of USDS that Staking Engine borrowers owe (principal plus accrued interest).'
  },
  {
    id: 'withdrawal-liquidity',
    title: 'Withdrawal liquidity',
    tooltip: 'The amount of stUSDS currently available for users to withdraw from the system.'
  },
  {
    id: 'curve-exchange-rate',
    title: 'Curve Exchange Rate',
    tooltip:
      'The exchange rate applied when your transaction is routed through the Curve pool instead of the Sky Protocol. The Curve rate may be higher or lower than the Sky Protocol rate depending on pool liquidity and market conditions.'
  },
  {
    id: 'native-exchange-rate',
    title: 'Native Exchange Rate',
    tooltip: 'The Sky Protocol’s internal exchange rate (no external routing or premiums).'
  },
  {
    id: 'liquidity-temporarily-utilized',
    title: 'Liquidity temporarily utilized',
    tooltip:
      'Native USDS liquidity on Ethereum is currently 100% utilized. As a result, withdrawing from the stUSDS module using the native route is temporarily disabled.'
  },
  {
    id: 'curve-vs-native-rate-difference',
    title: 'Curve vs. Native Rate difference',
    tooltip:
      'The difference, shown as percentage, between the Curve and Native (Protocol) exchange rates, calculated as (Curve Rate - Native Rate) / Native Rate x 100.'
  },
  {
    id: 'staking-rewards-rates-srrs',
    title: 'Staking Rewards Rates (SRRs)',
    tooltip:
      'SKY Staking Rewards are rate determined by Sky Governance through decentralized onchain voting. Sky.money does not control, set, or guarantee the rate. All yields are variable.'
  },
  {
    id: 'staked',
    title: 'Staked',
    tooltip: 'The amount of SKY you have staked in this position.'
  },
  {
    id: 'borrow-utilization',
    title: 'Borrow utilization',
    tooltip: 'The percentage of the debt ceiling currently being utilized for USDS borrowing.'
  },
  {
    id: 'borrow-rate',
    title: 'Borrow Rate',
    tooltip:
      'The Borrow Rate is determined by Sky Governance through decentralized onchain voting. Sky.money does not control the borrow rate. Borrowing carries liquidation risk.'
  },
  {
    id: 'borrow',
    title: 'Borrow',
    tooltip:
      'Borrowing against your staked collateral carries the risk of automatic liquidation without any possibility of recourse if at any time the value of your staked collateral drops below the required threshold and your position becomes undercollateralized. Please ensure you fully understand these risks before proceeding.'
  },
  {
    id: 'borrow-limit',
    title: 'Borrow limit',
    tooltip:
      'The USDS limit is determined by the amount of SKY locked in the Staking Engine, the current market price of SKY, and the amount of USDS borrowed.'
  },
  {
    id: 'capped-osm-sky-price',
    title: 'Capped OSM SKY price',
    tooltip:
      'The SKY price reported by the Oracle Security Module (OSM), capped at a governance-defined limit to prevent overvaluation during debt generation.'
  },
  {
    id: 'collateralization-ratio',
    title: 'Collateralization ratio',
    tooltip:
      'The ratio between the value of collateral you’ve provided and the amount you’ve borrowed against that collateral.'
  },
  {
    id: 'liquidation-price-staking',
    title: 'Liquidation price (Staking)',
    tooltip:
      "If the value of your collateral (SKY) drops below the liquidation price noted here, some or all of your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour price update delay applies. In other words, when SKY drops below a user's liquidation price it will only start applying one hour later. This is called the OSM delay in technical terms, and it also applies to any Maker MCD vault."
  },
  {
    id: 'risk-level',
    title: 'Risk level',
    tooltip:
      'Risk level indicates the likelihood of your collateral being liquidated. This is primarily determined by your Loan-to-Value (LTV) ratio, which represents the amount you’ve borrowed compared to the value of your crypto collateral. A high risk level means that your collateral is close to the liquidation price threshold, and most vulnerable to market changes. A medium risk level means you have a reasonable balance between borrowing power and a safety buffer. A low risk level means you have a comparatively wider safety net against price fluctuations.'
  },
  {
    id: 'debt-ceiling',
    title: 'Debt ceiling',
    tooltip:
      'The debt ceiling is the maximum amount of debt or tokens that can be issued within the SKY Protocol, serving as a risk management tool to ensure stability and limit overexposure. It is a parameter set by SKY token holders through decentralized onchain voting and subject to change.'
  },
  {
    id: 'debt-ceiling-utilization',
    title: 'Debt ceiling utilization',
    tooltip:
      'If the debt ceiling utilization reaches 100%, no new USDS can be borrowed. The debt ceiling is a parameter determined by SKY token holders through decentralized onchain voting.'
  },
  {
    id: 'max-permitted-risk',
    title: 'Max permitted risk',
    tooltip:
      'Risk cannot exceed the Max permitted risk level, determined by the capped OSM price and collateralization ratio requirements. To borrow more, stake additional SKY collateral.'
  },
  {
    id: 'risk-floor',
    title: 'Risk floor',
    tooltip:
      'Given the current amount of SKY deposited and USDS borrowed in this position, risk cannot be adjusted below the Risk floor. To lower the Risk floor, you must stake more SKY or repay USDS using the Unstake and Repay tab.'
  },
  {
    id: 'risk-ceiling',
    title: 'Risk ceiling',
    tooltip:
      'Given the current amount of SKY deposited and USDS borrowed in this position, risk cannot be increased above the Risk ceiling. To raise the Risk ceiling, you must either unstake SKY or borrow additional USDS.'
  },
  {
    id: 'risk-borrow',
    title: 'Risk (borrow)',
    tooltip:
      'Risk can only be adjusted upward when borrowing. To adjust downward, you can stake more SKY or repay USDS on the Unstake and Repay tab.'
  },
  {
    id: 'risk-repay',
    title: 'Risk (repay)',
    tooltip:
      'Risk can only be adjusted downward when repaying. To adjust upward, you can unstake SKY or borrow more USDS on the Stake and Borrow tab.'
  },
  {
    id: 'choose-your-delegate',
    title: 'Choose your delegate',
    tooltip: `When you hold SKY tokens, you may participate in Sky Protocol governance voting alongside other SKY token holders. That means that you have the ability to contribute to the community-driven, decentralized ecosystem decision-making process, which occurs through onchain voting.

The voting power delegation feature of the Staking Engine of the Sky Protocol enables you to entrust your voting power to a delegate of your choosing, who can then vote in Sky Protocol governance on your behalf. You can choose one delegate per SKY position. If you want to entrust your SKY to two delegates using the Staking Engine, you will need to create two separate positions.

Delegates granted voting power can never directly access any tokens delegated to them, including staked tokens. Throughout the delegation process, you always own and are in control of your staked tokens, and you can change your delegate at any time.Staking to delegate your voting power may be a useful option for governance token holders who have limited time to allocate to the process, who want to save on the cost of gas involved in voting on their own, and who also want to access Staking Rewards.`
  },
  {
    id: 'sealed',
    title: 'Sealed',
    tooltip: 'The amount of MKR you’ve sealed in this position.'
  },
  {
    id: 'deprecation-warning-if-the-user-has-positions',
    title: 'Deprecation warning (if the user has positions)',
    tooltip: `Seal Engine is deprecated. Creation of new positions has been disabled. Management of existing positions remains available.

Exit your positions now.`
  },
  {
    id: 'deprecation-warning-if-the-user-has-no-positions',
    title: 'Deprecation warning (if the user has no positions)',
    tooltip: `Seal Engine is deprecated. Creation of new positions has been disabled. Management of existing positions remains available.

You don't have any open positions.`
  },
  {
    id: 'liquidation-price-seal',
    title: 'Liquidation price (Seal)',
    tooltip:
      "If the value of your collateral (MKR or SKY) drops below the liquidation price noted here, some or all of your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour price update delay applies. In other words, when MKR or SKY drops below a user's liquidation price it will only start applying one hour later. This is called the OSM delay in technical terms, and it also applies to any Maker MCD vault."
  },
  {
    id: 'delayed-upgrade-penalty',
    title: 'Delayed Upgrade Penalty',
    tooltip: `The Delayed Upgrade Penalty is a time-based penalty [approved by Sky Ecosystem Governance](https://vote.sky.money/executive/template-executive-vote-delayed-upgrade-penalty-launch-agent-2-allocator-adjustment-lsev2-sky-a-liquidation-ratio-increase-first-monthly-settlement-cycle-ad-compensation-for-september-2025-atlas-core-development-usds-and-sky-payments-spark-proxy-spell-september-18-2025) and designed to facilitate a smooth and prompt upgrade of MKR to SKY.

The penalty, which took effect in September 2025, reduces the amount of SKY received per MKR upgraded by a rate of 1%. The reduction will increase by an additional 1% every three months thereafter, until it reaches 100% in 25 years.`
  },
  {
    id: 'eip-7702-bundled-transactions-not-supported',
    title: 'Eip-7702 Bundled transactions not supported',
    tooltip: `Bundled transactions enable a one-click, gas-optimized user experience that aligns with the best practices of the broader Ethereum ecosystem.

Bundled transaction: Active`
  },
  {
    id: 'legal-notice',
    title: 'Legal Notice',
    tooltip:
      "Please note that all security checks, user confirmations, and error handling are managed by your chosen wallet's delegate contract. As outlined in our [Terms of Use](https://docs.sky.money/legal-terms), your use of a non-custodial digital wallet—including wallets supporting EIP-7702 and smart account functionality—is governed by the terms of service of your third-party wallet provider. We do not control or take responsibility for the security, functionality, or behavior of third-party wallets, including their handling of bundled transactions or delegate contracts. To help ensure a secure and transparent experience, please be certain you are using a trusted and up-to-date wallet before proceeding."
  },
  {
    id: 'gas-fee',
    title: 'Gas fee',
    tooltip:
      'Every time you engage in transactions with your assets (e.g., buy, sell, trade or transfer them) on the Sky Protocol you may pay a transaction fee— called a gas fee—for using the Ethereum blockchain network. That fee is not controlled, imposed or received by Sky.money or the Sky Protocol; it is calculated based on current network demand and the amount of gas required to process your transaction.'
  },
  {
    id: 'exchange-rate',
    title: 'Exchange Rate',
    tooltip:
      'Exchange Rate refers to the price of one currency relative to another at any given moment. Cryptocurrency exchange rates may be subject to price volatility and may fluctuate based on various factors. The final amount you will receive is estimated, based on your chosen slippage tolerance level.'
  },
  {
    id: 'psm',
    title: 'PSM',
    tooltip:
      'Peg Stability Modules (PSMs) are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low or no fees. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol. The 1:1 Conversion feature surfaces existing PSM functionality as a dedicated conversion flow, available on Ethereum Mainnet via the UsdsPsmWrapper and on supported L2 networks via PSM3 contracts, which are governed by Sky Ecosystem Governance.'
  },
  {
    id: 'slippage',
    title: 'Slippage',
    tooltip: 'This reflects your slippage tolerance level.'
  },
  {
    id: 'slippage-tolerance',
    title: 'Slippage Tolerance',
    tooltip:
      'By setting your slippage tolerance level, you control the degree of token price fluctuation that you will accept between the time you initiate a trade transaction and its execution on the blockchain. If the actual slippage is greater than your chosen tolerance level, the transaction will fail and be reverted. Note that reverted transactions may still incur gas fees.'
  },
  {
    id: 'sky-savings-rate',
    title: 'Sky Savings Rate',
    tooltip:
      'The Sky Savings Rate is a variable protocol rate funded from aggregate Sky protocol surplus, and it can change over time. sUSDS is not exposure to any specific Agent, borrower, collateral pool, or asset strategy. Sky.money does not control, set, or guarantee the rate.'
  },
  {
    id: 'vault-rate',
    title: 'Vault Rate',
    tooltip:
      'Vaults are curated by Sky.money and run on Morpho vault contracts. Sky.money selects the lending markets each vault may use and sets exposure limits; it does not hold vault assets. The rate is variable and market-set, depending on borrowing demand and conditions in each underlying market. Sky.money does not set or guarantee it, and it is not a protocol rate set by Sky governance.'
  },
  {
    id: 'vault-rates',
    title: 'Vault Rates',
    tooltip:
      "The rates shown reflect the range of variable rates currently offered across the vaults available here, from lowest to highest. These vaults come from different sources: some are curated by Skybase on third-party lending protocols such as Morpho, while others are first-party vaults built on Spark infrastructure. Each vault's rate is variable and depends on that specific vault - its underlying strategy, the market conditions and supply-and-demand dynamics of the lending markets or products it uses, and its risk profile. Sky.money does not control or guarantee vault performance. The rates shown are estimated annual rates, updated using data from the relevant protocols, for informational purposes only, and do not guarantee future results."
  },
  {
    id: 'susdt-vault-rate',
    title: 'sUSDT Vault Rate',
    tooltip:
      'The Tether Savings (sUSDT) Vault rate is variable and set by Sky. Sky sets the sUSDT savings rate against three inputs: profit-and-loss sustainability across the full deposit base, depositor composition, and on-chain borrow demand - adjusting the rate to reflect what deployment yields can support. The rate shown is an estimated annual rate provided for informational purposes only and does not guarantee future results. Sky.money does not control or guarantee vault performance.'
  },
  {
    id: 'pt-susds',
    title: 'PT-sUSDS',
    tooltip:
      'PT-sUSDS is a Principal Token issued by Pendle that represents the right to redeem an underlying amount of USDS via sUSDS at a specific future maturity date. It is purchased at a discount to its redemption value, and that discount is what produces the fixed APY when held to maturity. PT-sUSDS is a tradable derivative, not a stablecoin - its market price can fluctuate before maturity.'
  },
  {
    id: 'fixed-yield-rate',
    title: 'Fixed Yield Rate',
    tooltip:
      'Fixed Yield sUSDS is a third-party integration using Pendle Protocol, with the Sky Savings Rate as the underlying yield source. The rate is market-set; Sky.money does not set, control, or guarantee it. The rate is fixed only if you hold to the maturity date. Exiting before maturity means selling at the prevailing market price, which may be above or below your entry.'
  },
  {
    id: 'maturity-date',
    title: 'Maturity Date',
    tooltip:
      'The Maturity Date is when your PT-sUSDS becomes redeemable for its full USDS value, securing your fixed return. You can redeem on or after this date. If you hold past this date, your position stops earning yield. If you sell before maturity, your exit value is the prevailing market price. This date is fixed when the Pendle market is created.'
  },
  {
    id: 'effective-apy',
    title: 'Effective APY',
    tooltip:
      'The Effective APY is the realized annualized yield for a specific order, after accounting for the price impact of trading PT-sUSDS on the Pendle market. Larger orders can move the market price, which may reduce the Effective APY relative to the headline Fixed Yield Rate. The Effective APY shown is an estimate based on current market conditions and may change before the transaction is executed.'
  },
  {
    id: 'early-withdrawal-impact',
    title: 'Early Withdrawal Impact',
    tooltip:
      'Withdrawing before the Maturity Date requires selling PT-sUSDS on the Pendle market rather than redeeming it for the fixed amount. The realized APY on an early withdrawal depends on the prevailing PT-sUSDS market price and may be higher or lower than the Fixed Yield Rate locked in at supply. The displayed APY is fixed only if PT-sUSDS is held to or past maturity.'
  },
  {
    id: 'early-withdrawal-loss',
    title: 'Lost on Early Withdrawal',
    tooltip:
      'The difference between what you would claim at maturity and what you receive by withdrawing now.'
  },
  {
    id: 'earn-rates',
    title: 'Rate',
    tooltip:
      'All rates are variable, and their mechanics depend on the particular product. Sky.money does not control, set, or guarantee these rates. Refer to the product pages for further details.'
  },
  {
    id: 'earn-rates-30d',
    title: '30D Rate',
    tooltip: 'Average rates over the past 30 days. Past performance is not indicative of future results.'
  },
  {
    id: 'rewards-rate',
    title: 'Rewards Rate',
    tooltip:
      'Sky Ecosystem Rewards are issued and distributed by independent partners and Agents working with Sky. Sky.money does not control their issuance, rate, or value; all rewards are variable and subject to market conditions.'
  }
];

// Helper function to get tooltip by ID with fallback to legacy tooltips
export function getTooltipById(id: string): Tooltip | undefined {
  // First, try to find in current tooltips
  const tooltip = tooltips.find(t => t.id === id);
  if (tooltip) {
    return tooltip;
  }

  // If not found, fallback to legacy tooltips
  return getLegacyTooltipById(id);
}

// Helper function to get multiple tooltips by IDs and return them as an array
export function getTooltipsByIds(ids: string[]): Tooltip[] {
  return ids.map(id => getTooltipById(id)).filter((tooltip): tooltip is Tooltip => tooltip !== undefined);
}
