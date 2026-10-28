import { TokenForChain } from '@/hooks/tokens/types';

export type WidgetsConfig = {
  balancesTokenList: Record<number, TokenForChain[]>;
  tradeTokenList: Record<number, TokenForChain[]>;
};
