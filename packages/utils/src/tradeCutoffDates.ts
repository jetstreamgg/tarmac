import { arbitrum, base } from 'wagmi/chains';
// TODO: update before launch
// Cutoff dates for when each L2 switched from PSM to CowSwap
// Trades before these dates will be fetched from PSM, after from CowSwap
export const TRADE_CUTOFF_DATES: Record<number, Date> = {
  [base.id]: new Date('2025-09-19T00:00:00Z'), // September 19, 2025
  [arbitrum.id]: new Date('2025-09-19T00:00:00Z') // September 19, 2025
};
