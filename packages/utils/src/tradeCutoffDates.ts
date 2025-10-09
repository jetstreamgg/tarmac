import { arbitrum, base } from 'wagmi/chains';

// Cutoff dates for when each L2 switched from PSM to CowSwap
// Trades before these dates will be fetched from PSM, after from CowSwap
export const TRADE_CUTOFF_DATES: Record<number, Date> = {
  [base.id]: new Date('2025-10-09T19:30:00Z'), // October 9, 2025 19:30pm UTC
  [arbitrum.id]: new Date('2025-10-09T19:30:00Z') // October 9, 2025 19:30pm UTC
};
