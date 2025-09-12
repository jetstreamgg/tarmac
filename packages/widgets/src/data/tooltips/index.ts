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
    id: 'staked',
    title: 'Staked',
    tooltip: 'The amount of SKY you have staked in this position.'
  },
  {
    id: 'borrow-rate',
    title: 'Borrow rate',
    tooltip:
      'The Borrow Rate is determined by Sky Ecosystem Governance through a process of community-driven, decentralized onchain voting.'
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
      'The USDS limit is determined by the amount SKY locked in the Staking Engine, the current market price of SKY, and the amount of USDS borrowed.'
  },
  {
    id: 'collateralization-ratio',
    title: 'Collateralization ratio',
    tooltip:
      'The ratio between the value of collateral you’ve provided and the amount you’ve borrowed against that collateral.'
  },
  {
    id: 'liquidation-price',
    title: 'Liquidation price',
    tooltip:
      "If the value of your collateral (MKR or SKY) drops below the liquidation price noted here, some or all of your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour price update delay applies. In other words, when MKR or SKY drops below a user's liquidation price it will only start applying one hour later. This is called the OSM delay in technical terms, and it also applies to any legacy Maker MCD vault."
  },
  {
    id: 'risk-level',
    title: 'Risk level',
    tooltip:
      'Risk level indicates the likelihood of your collateral being liquidated. This is primarily determined by your Loan-to-Value (LTV) ratio, which represents the amount you’ve borrowed compared to the value of your crypto collateral. A high risk level means your collateral is close to the liquidation price threshold, and most vulnerable to market changes. A medium risk level means you have a reasonable balance between borrowing power and a safety buffer. A low risk level means you have a comparatively wider safety next against price fluctuations.'
  },
  {
    id: 'debt-ceiling',
    title: 'Debt ceiling',
    tooltip:
      'The debt ceiling is the maximum amount of debt or tokens that can be issued within the SKY protocol, serving as a risk management tool to ensure stability and limit overexposure. It is a parameter subject to change by the Sky Ecosystem Governance.'
  },
  {
    id: 'debt-ceiling-utilization',
    title: 'Debt ceiling utilization',
    tooltip:
      'If the debt ceiling utilization reaches 100%, no new USDS can be borrowed. The debt ceiling is a parameter determined by Sky ecosystem governance through a process of decentralized onchain voting.'
  },
  {
    id: 'choose-your-delegate',
    title: 'Choose your delegate',
    tooltip: `When you hold SKY tokens, you maintain the right to participate in the process of Sky Ecosystem Governance voting. That means that you have the ability to contribute to the community-driven, decentralized ecosystem decision-making process, which occurs through onchain voting.

The voting power delegation feature of the Staking Engine of the Sky Protocol enables you to entrust your voting power to a delegate of your choosing, who can then vote in the Sky Ecosystem Governance process on your behalf. You can choose one delegate per SKY position. If you want to entrust your SKY to two delegates using the Staking Engine, you will need to create two separate positions.

Delegates in receipt of token voting power can never directly access any tokens delegated to them, including staked tokens. Throughout the delegation process, you always own and are in control of your staked tokens, and you can change your delegate at any time.Staking to delegate your voting power may be a useful option for governance token holders who have limited time to allocate to the process, who want to save on the cost of gas involved in voting on their own, and who also want to access Staking Rewards.`
  },
  {
    id: 'sealed',
    title: 'Sealed',
    tooltip: 'The amount of MKR you’ve sealed in this position.'
  },
  {
    id: 'deprecation-warning',
    title: 'Deprecation warning',
    tooltip:
      'Seal Engine is being deprecated. Exit your positions now. Migration to Staking Engine coming soon.'
  },
  {
    id: 'delayed-upgrade-penalty',
    title: 'Delayed Upgrade Penalty',
    tooltip: `The Delayed Upgrade Penalty is a time-based upgrade mechanism approved by Sky Ecosystem Governance and designed to facilitate a smooth and prompt upgrade of MKR to SKY.

The vote to confirm the penalty will [be held on September 18, 2025](https://upgrademkrtosky.sky.money/). If the vote passes, the penalty will take effect on September 22, 2025.

Once in effect, the amount of SKY received per MKR upgraded during the first three months will be reduced by 1%. The reduction will increase by an additional 1% every three months thereafter, until it reaches 100% in 25 years. The penalty will not apply to anyone upgrading their MKR to SKY before it kicks in.`
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
      "Please note that all security checks, user confirmations, and error handling are managed by your chosen wallet's delegate contract. As outlined in our Terms of Use, your use of a non-custodial digital wallet—including wallets supporting EIP-7702 and smart account functionality—is governed by the terms of service of your third-party wallet provider. We do not control or take responsibility for the security, functionality, or behavior of third-party wallets, including their handling of bundled transactions or delegate contracts. To ensure a secure and transparent experience, please ensure you are using a trusted and up-to-date wallet before proceeding."
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
      'Exchange rate refers to the price of one cryptocurrency relative to another cryptocurrency or fiat currency at any given moment. Cryptocurrency exchange rates may be subject to price volatility and may fluctuate based on various factors. The final amount you will receive is estimated, based on your chosen slippage tolerance level.'
  },
  {
    id: 'psm',
    title: 'PSM',
    tooltip:
      'Peg Stability Modules (PSMs) are smart contracts that allow users to convert certain stablecoins directly with the Sky Protocol for USDS or DAI at a fixed rate and with relatively low fees. They are designed to maintain the stability of USDS and DAI. Unlike decentralized exchange (DEX) transactions, PSM operations do not involve trading between users. Instead, they are direct, non-custodial conversions (generate and burn) executed with the decentralized smart contracts of the Sky Protocol.'
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
    id: 'rate',
    title: 'Rate',
    tooltip:
      'The Sky Savings Rate is variable, determined by decentralized, onchain Sky Ecosystem Governance, and configured on the Ethereum blockchain. Sky Ecosystem Governance is able to adapt the SSR and other relevant parameters at any time at its discretion and without notice, based on market conditions, protocol surplus and other factors. The rate shown here is an estimate of the Sky Savings Rate representing the expected compounded rate per annum. It should be automatically updated every 5 minutes, and is powered by data provided by a third party ([Block Analitica](https://blockanalitica.com/)). This figure does not promise or guarantee future results.'
  },
  {
    id: 'rewards-rate',
    title: 'Rewards Rate',
    tooltip: `The Sky Token Rewards Rate is different for each type of token rewarded, and always fluctuates, determined by the following factors:

- The issuance rate of the token rewarded, which is determined by Sky Ecosystem Governance;

- The market price of the token rewarded; and

- The user's proportional supply within the total pool of assets linked to the Sky Token Rewards module.

Sky.money does not control the issuance, determination, or distribution of these rewards. The Sky Token Rewards Rate is variable and may fluctuate. It is determined by: (1) the current issuance rate of the reward token set through onchain governance processes, (2) the token's current market price, and (3) each user's proportional percentage of the total supply in the pool automatically accruing rewards. The STR rate provided is an estimated annual rate, updated every 5 minutes using data from a third party provider (Block Analitica,). This estimate is for informational purposes only and does not guarantee future results.`
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
