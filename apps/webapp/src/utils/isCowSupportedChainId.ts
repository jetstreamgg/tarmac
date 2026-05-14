import { isMainnetId } from './isMainnetId';
import { TRADE_CUTOFF_DATES } from './tradeCutoffDates';

export const isCowSupportedChainId = (chainId: number) => {
  return isMainnetId(chainId) || chainId in TRADE_CUTOFF_DATES;
};
