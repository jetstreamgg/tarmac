import { TokenForChain } from '@/hooks';

export type WidgetsConfig = {
  balancesTokenList: Record<number, TokenForChain[]>;
  tradeTokenList: Record<number, TokenForChain[]>;
};
