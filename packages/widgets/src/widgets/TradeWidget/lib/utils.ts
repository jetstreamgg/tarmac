import { HandledQuoteErrorTypes, SUPPORTED_TOKEN_SYMBOLS } from './constants';
import { TokenForChain } from '@jetstreamgg/sky-hooks';

function makeBidirectional(
  pairs?: Record<string, SUPPORTED_TOKEN_SYMBOLS[]>
): Record<string, SUPPORTED_TOKEN_SYMBOLS[]> | undefined {
  if (!pairs) return undefined;

  const bidirectionalPairs = { ...pairs };

  for (const [inputToken, targetTokens] of Object.entries(pairs)) {
    for (const targetToken of targetTokens) {
      if (!bidirectionalPairs[targetToken]) {
        bidirectionalPairs[targetToken] = [];
      }
      if (!bidirectionalPairs[targetToken].includes(inputToken as SUPPORTED_TOKEN_SYMBOLS)) {
        bidirectionalPairs[targetToken].push(inputToken as SUPPORTED_TOKEN_SYMBOLS);
      }
    }
  }

  return bidirectionalPairs;
}

const targetTokensSort = (a: TokenForChain, b: TokenForChain): number => {
  const order = ['USDS', 'sUSDS', 'SKY', 'DAI', 'MKR'];
  const aIndex = order.indexOf(a.symbol);
  const bIndex = order.indexOf(b.symbol);

  if (aIndex !== -1 && bIndex !== -1) {
    return aIndex - bIndex;
  } else if (aIndex !== -1) {
    return -1;
  } else if (bIndex !== -1) {
    return 1;
  }
  return a.symbol.localeCompare(b.symbol);
};

export function getAllowedTargetTokens(
  inputTokenSymbol: string,
  targetTokenList: TokenForChain[],
  disallowedPairs?: Record<string, SUPPORTED_TOKEN_SYMBOLS[]>
) {
  const sortedTargetTokenList = targetTokenList.toSorted(targetTokensSort);

  if (!disallowedPairs || !inputTokenSymbol) return sortedTargetTokenList;

  // Get the disallowed target symbols for the given input token
  const bidirectionalPairs = makeBidirectional(disallowedPairs);
  const disallowedTargetSymbols = (bidirectionalPairs || {})[inputTokenSymbol];

  if (!disallowedTargetSymbols) return sortedTargetTokenList;

  return sortedTargetTokenList.filter(
    targetToken => !disallowedTargetSymbols.includes(targetToken.symbol as SUPPORTED_TOKEN_SYMBOLS)
  );
}

export function getQuoteErrorForType(errorType: HandledQuoteErrorTypes | string) {
  switch (errorType) {
    case HandledQuoteErrorTypes.NoLiquidity:
      return 'Request declined. Either you’ve entered an amount that does not meet the minimum required to trade, or there is insufficient liquidity available to process the amount you’ve entered.';
    case HandledQuoteErrorTypes.SellAmountDoesNotCoverFee:
      return 'Costs exceed the amount you want to trade';
    default:
      return 'There was an error while fetching the quote for this pair';
  }
}

// Check if slippage is a valid number and compare it with its
// minimum and maximum values. Then, return the input value or the default value
export const verifySlippage = (s: string, slippageConfig: { min: number; max: number; default: number }) =>
  !!s && !Number.isNaN(+s) && +s >= +slippageConfig.min && +s <= +slippageConfig.max ? s : '';
