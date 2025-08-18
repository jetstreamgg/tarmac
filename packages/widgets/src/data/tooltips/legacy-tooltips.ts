export interface Tooltip {
  id: string;
  title: string;
  tooltip: string;
}

export const legacyTooltips: Tooltip[] = [
  // Stake Module tooltips
  {
    id: 'collateralization-ratio',
    title: 'Collateralization ratio',
    tooltip:
      "The ratio between the value of collateral you've provided and the amount you've borrowed against that collateral."
  },
  {
    id: 'liquidation-price',
    title: 'Liquidation price',
    tooltip:
      "If the value of your collateral (SKY) drops below the liquidation price noted here, some or all of your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour price update delay applies. In other words, when SKY drops below a user's liquidation price it will only start applying one hour later. This is called the OSM delay in technical terms, and it also applies to any legacy Maker MCD vault."
  },
  {
    id: 'risk-level',
    title: 'Risk level',
    tooltip:
      "Risk level indicates the likelihood of your collateral being liquidated. This is primarily determined by your Loan-to-Value (LTV) ratio, which represents the amount you've borrowed compared to the value of your crypto collateral. A high risk level means your collateral is close to the liquidation price threshold, and most vulnerable to market changes. A medium risk level means you have a reasonable balance between borrowing power and a safety buffer. A low risk level means you have a comparatively wider safety next against price fluctuations."
  },
  {
    id: 'debt-ceiling',
    title: 'Debt ceiling',
    tooltip:
      'If the debt ceiling utilization reaches 100%, no new USDS can be borrowed. The debt ceiling is a parameter determined by Sky ecosystem governance through a process of decentralized onchain voting.'
  },
  {
    id: 'borrow-rate',
    title: 'Borrow rate',
    tooltip:
      'The Borrow Rate is determined by Sky Ecosystem Governance through a process of community-driven, decentralized onchain voting.'
  },
  {
    id: 'available-to-borrow',
    title: 'Available to borrow',
    tooltip: 'The maximum amount of USDS you can still borrow based on your collateral and current position.'
  },
  {
    id: 'available-to-withdraw',
    title: 'Available to withdraw',
    tooltip: 'The maximum amount of SKY you can withdraw while maintaining your position.'
  },

  // Seal Module tooltips
  {
    id: 'sealed-amount-mkr',
    title: 'Sealed',
    tooltip: "The amount of MKR you've sealed in this position."
  },
  {
    id: 'sealed-amount-sky',
    title: 'Sealed',
    tooltip: "The amount of SKY you've sealed in this position."
  },
  {
    id: 'borrowed-amount-seal',
    title: 'Borrowed',
    tooltip: "The amount of USDS you've borrowed using your sealed tokens as collateral."
  },
  {
    id: 'available-to-borrow-seal',
    title: 'Available to borrow',
    tooltip:
      'The maximum amount of USDS you can still borrow based on your sealed collateral and current position.'
  },
  {
    id: 'available-to-withdraw-seal',
    title: 'Available to withdraw',
    tooltip: 'The maximum amount of sealed tokens you can withdraw while maintaining your position.'
  },
  {
    id: 'collateralization-ratio-seal',
    title: 'Collateralization ratio',
    tooltip:
      "The ratio between the value of sealed collateral you've provided and the amount you've borrowed against that collateral."
  },
  {
    id: 'liquidation-price-seal-mkr',
    title: 'Liquidation price',
    tooltip:
      "If the value of your collateral (MKR) drops below the liquidation price noted here, some or all of your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour price update delay applies. In other words, when MKR drops below a user's liquidation price it will only start applying one hour later. This is called the OSM delay in technical terms, and it also applies to any legacy Maker MCD vault."
  },
  {
    id: 'liquidation-price-seal-sky',
    title: 'Liquidation price',
    tooltip:
      "If the value of your collateral (SKY) drops below the liquidation price noted here, some or all of your collateral may be auctioned to repay the amount of USDS that you borrowed. Note that a one-hour price update delay applies. In other words, when SKY drops below a user's liquidation price it will only start applying one hour later. This is called the OSM delay in technical terms, and it also applies to any legacy Maker MCD vault."
  },
  {
    id: 'risk-level-seal',
    title: 'Risk level',
    tooltip:
      "Risk level indicates the likelihood of your collateral being liquidated. This is primarily determined by your Loan-to-Value (LTV) ratio, which represents the amount you've borrowed compared to the value of your crypto collateral. A high risk level means your collateral is close to the liquidation price threshold, and most vulnerable to market changes. A medium risk level means you have a reasonable balance between borrowing power and a safety buffer. A low risk level means you have a comparatively wider safety next against price fluctuations."
  },
  {
    id: 'debt-ceiling-seal',
    title: 'Debt ceiling',
    tooltip:
      'If the debt ceiling utilization reaches 100%, no new USDS can be borrowed. The debt ceiling is a parameter determined by Sky ecosystem governance through a process of decentralized onchain voting.'
  },
  {
    id: 'borrow-rate-seal',
    title: 'Borrow rate',
    tooltip:
      'The Borrow Rate is determined by Sky Ecosystem Governance through a process of community-driven, decentralized onchain voting.'
  }
];

// Helper function to get tooltip by ID
export function getLegacyTooltipById(id: string): Tooltip | undefined {
  return legacyTooltips.find(t => t.id === id);
}
