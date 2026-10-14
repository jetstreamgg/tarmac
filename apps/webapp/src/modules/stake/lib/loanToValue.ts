import { WAD } from '@/utils';

// Debt over collateral at the capped OSM price (what the protocol enforces), so it agrees
// with the liquidation price and the SKY price shown next to it. No debt → no LTV.
export const loanToValue = (debtValue: bigint | undefined, collateralValue: bigint | undefined) =>
  debtValue && collateralValue ? (debtValue * WAD) / collateralValue : undefined;
