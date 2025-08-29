import { isArbitrumChainId, isBaseChainId } from './isL2ChainId';
import { isMainnetId } from './isMainnetId';

export const isCowSupportedChainId = (chainId: number) => {
  return isMainnetId(chainId) || isArbitrumChainId(chainId) || isBaseChainId(chainId);
};
