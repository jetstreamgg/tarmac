import { formatUnits } from 'viem';

export const USDS_DECIMALS = 18;

/** A USDS wei amount as a number, for display and USD values. */
export const usdsToNumber = (amount: bigint): number => parseFloat(formatUnits(amount, USDS_DECIMALS));
