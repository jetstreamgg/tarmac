import { ReactNode } from 'react';
import { chainId } from './chainId';

export const getChainSpecificText = (
  chainTexts: {
    ethereum?: ReactNode;
    allL2s?: ReactNode;
    base?: ReactNode;
    arbitrum?: ReactNode;
    optimism?: ReactNode;
    unichain?: ReactNode;
    default: ReactNode;
  },
  id: number
) => {
  switch (id) {
    case chainId.mainnet:
    case chainId.tenderly:
      return chainTexts.ethereum || chainTexts.default;
    case chainId.base:
      return chainTexts.base || chainTexts.allL2s || chainTexts.default;
    case chainId.arbitrum:
      return chainTexts.arbitrum || chainTexts.allL2s || chainTexts.default;
    case chainId.optimism:
      return chainTexts.optimism || chainTexts.allL2s || chainTexts.default;
    case chainId.unichain:
      return chainTexts.unichain || chainTexts.allL2s || chainTexts.default;
    default:
      return chainTexts.default;
  }
};
