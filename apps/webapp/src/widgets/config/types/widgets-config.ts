import { SUPPORTED_TOKEN_SYMBOLS } from '@/widgets/TradeWidget/lib/constants';
import { TokenForChain } from '@/hooks';

export type WidgetsConfig = {
  balancesTokenList: Record<number, TokenForChain[]>;
  tradeTokenList: Record<number, TokenForChain[]>;
  tradeDisallowedPairs?: Record<string, SUPPORTED_TOKEN_SYMBOLS[]>;
};
