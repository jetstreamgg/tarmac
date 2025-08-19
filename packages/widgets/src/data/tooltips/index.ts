import { getLegacyTooltipById } from './legacy-tooltips';

export interface Tooltip {
  id: string;
  title: string;
  tooltip: string;
}

export const tooltips: Tooltip[] = [
  {
    id: 'staked',
    title: 'Staked:',
    tooltip: 'The amount of SKY you have staked in this position.'
  },
  {
    id: 'borrowed',
    title: 'Borrowed:',
    tooltip: 'The amount of USDS you have borrowed.'
  },
  {
    id: 'borrow-rate',
    title: 'Borrow Rate:',
    tooltip:
      'The Borrow Rate is determined by Sky Ecosystem Governance through a process of community-driven, decentralized onchain voting.'
  },
  {
    id: 'borrowing-tool-tip',
    title: 'Borrowing Tool tip',
    tooltip: `Borrowing against your staked collateral carries the risk of automatic liquidation without any possibility of recourse if at any time the value of your staked collateral drops below the required threshold and your position becomes undercollateralized. Please ensure you fully understand these risks before proceeding.

The USDS limit is determined by the amount SKY locked in the Staking Engine, the current market price of SKY, and the amount of USDS borrowed.`
  },
  {
    id: 'collateralization-ratio',
    title: 'Collateralization Ratio:',
    tooltip:
      "The ratio between the value of the collateral you've provided and the amount you've borrowed against that collateral."
  },
  {
    id: 'liquidation-price',
    title: 'Liquidation price:',
    tooltip:
      "If the value of your collateral (SKY) drops below the liquidation price noted here, some or all of your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour price update delay applies. In other words, when SKY drops below a user's liquidation price it will only start applying one hour later. This is called the OSM delay in technical terms, and it also applies to any legacy Maker MCD vault."
  },
  {
    id: 'risk-level',
    title: 'Risk level',
    tooltip:
      'Risk level indicates the likelihood of your collateral being liquidated. This is primarily determined by your Loan-to-Value (LTV) ratio, which represents the amount you have borrowed compared to the value of your crypto collateral. A high risk level means that your collateral is close to the liquidation price threshold and most vulnerable to market changes. A medium risk level means you have a reasonable balance between borrowing power and a safety buffer. A low risk level means you have a comparatively wider safety net against price fluctuations.'
  },
  {
    id: 'debt-ceiling',
    title: 'Debt Ceiling',
    tooltip:
      'The debt ceiling is the maximum amount of debt or tokens that can be issued within the SKY protocol, serving as a risk management tool to ensure stability and limit overexposure. It is a parameter subject to change by the Sky Ecosystem Governance.'
  },
  {
    id: 'debt-ceiling-utilization',
    title: 'Debt Ceiling Utilization',
    tooltip:
      'If the debt ceiling utilization reaches 100%, no new USDS can be borrowed. The debt ceiling is a parameter determined by Sky ecosystem governance through a process of decentralized onchain voting.'
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
