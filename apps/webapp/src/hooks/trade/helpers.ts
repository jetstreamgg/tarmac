import { formatUnits, parseUnits } from 'viem';
import { WAD_PRECISION, math } from '@/utils';

// Converts a raw token amount (in the token's native decimals) and a decimal price string
// into a USD value as a float. The price is parsed to WAD so the result is WAD-scaled
// regardless of the token's decimals
export const calculateAmountUsd = (amount: bigint, price: string, tokenDecimals: number): number => {
  return parseFloat(
    formatUnits(math.tokenValue(amount, parseUnits(price, WAD_PRECISION), tokenDecimals), WAD_PRECISION)
  );
};
