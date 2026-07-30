import { formatUnits, parseUnits } from 'viem';
import { WAD_PRECISION, math } from '@/utils';
import { TOKENS } from '../tokens/tokens.constants';

const STABLECOIN_SYMBOLS = new Set([
  TOKENS.usdc.symbol,
  TOKENS.usdt.symbol,
  TOKENS.dai.symbol,
  TOKENS.usds.symbol
]);
const STABLE_PAIR_AUTO_SLIPPAGE = 0.05;
const VOLATILE_PAIR_AUTO_SLIPPAGE = 0.3;

// Converts a raw token amount (in the token's native decimals) and a decimal price string
// into a USD value as a float. The price is parsed to WAD so the result is WAD-scaled
// regardless of the token's decimals
export const calculateAmountUsd = (amount: bigint, price: string, tokenDecimals: number): number => {
  return parseFloat(
    formatUnits(math.tokenValue(amount, parseUnits(price, WAD_PRECISION), tokenDecimals), WAD_PRECISION)
  );
};

export function getAutoSlippage(originSymbol?: string, targetSymbol?: string): number {
  if (
    originSymbol &&
    targetSymbol &&
    STABLECOIN_SYMBOLS.has(originSymbol) &&
    STABLECOIN_SYMBOLS.has(targetSymbol)
  ) {
    return STABLE_PAIR_AUTO_SLIPPAGE;
  }
  return VOLATILE_PAIR_AUTO_SLIPPAGE;
}

export const verifySlippageAndDeadline = ({
  slippage,
  ttl,
  isEthFlow,
  isL2,
  originSymbol,
  targetSymbol
}: {
  slippage?: string;
  ttl?: string;
  isEthFlow: boolean;
  isL2: boolean;
  originSymbol?: string;
  targetSymbol?: string;
}) => {
  const parsedSlippage = parseFloat(slippage || '');
  const parsedTtl = parseFloat(ttl || '');

  // These are using Uniswap app's default limits and values, which are between 0 and 50% (default 0.5%)
  // for slippage and between 1 and 180 minutes (default 30 minutes) for the transaction deadline
  const minSlippage = isEthFlow ? (isL2 ? 0.5 : 2) : 0;
  const maxSlippage = 50;
  const defaultSlippage = isEthFlow ? (isL2 ? 0.5 : 2) : getAutoSlippage(originSymbol, targetSymbol);

  const validatedSlippage =
    !Number.isNaN(parsedSlippage) && parsedSlippage >= minSlippage && parsedSlippage <= maxSlippage
      ? parsedSlippage
      : defaultSlippage;

  const validatedTtl = !Number.isNaN(parsedTtl) && parsedTtl >= 1 && parsedTtl <= 180 ? parsedTtl : 30;

  return {
    slippage: validatedSlippage,
    ttl: +(validatedTtl * 60).toFixed(0)
  };
};
