import { SUPPORTED_TOKEN_SYMBOLS } from '@/widgets/TradeWidget/lib/constants';

type InputTokenList = {
  [number]: Token[];
};
type TargetTokenList = {
  [number]: Token[];
};

export type WidgetsConfig = {
  balancesTokenList: Record<number, TokenForChain[]>;
  tradeTokenList: Record<number, TokenForChain[]>;
  tradeDisallowedPairs?: Record<string, SUPPORTED_TOKEN_SYMBOLS[]>;
};
