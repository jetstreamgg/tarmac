import { formatNumber } from './formatValue';
import { formatUnits } from 'viem';

export const formatTradeAmount = (input: bigint, decimals: number = 18): string => {
  return formatNumber(parseFloat(formatUnits(input, decimals)), { locale: 'en-US', compact: true });
};
