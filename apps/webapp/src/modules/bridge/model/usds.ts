import { formatUnits } from 'viem';
import { formatNumber } from '@/utils';

export const USDS_DECIMALS = 18;

/** A USDS wei amount as a number, for display and USD values. */
export const usdsToNumber = (amount: bigint): number => parseFloat(formatUnits(amount, USDS_DECIMALS));

/** "1,234.50" by default. */
export const formatUsds = (
  amount: bigint,
  options: Parameters<typeof formatNumber>[1] = { minDecimals: 2, maxDecimals: 2 }
): string => formatNumber(usdsToNumber(amount), options);
