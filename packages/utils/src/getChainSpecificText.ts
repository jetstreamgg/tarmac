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
    case chainId.sepolia:
    case chainId.tenderly:
      return chainTexts.ethereum || chainTexts.default;
    case chainId.base:
    case chainId.tenderlyBase:
      return chainTexts.base || chainTexts.allL2s || chainTexts.default;
    case chainId.arbitrum:
    case chainId.tenderlyArbitrum:
      return chainTexts.arbitrum || chainTexts.allL2s || chainTexts.default;
    case chainId.optimism:
      return chainTexts.optimism || chainTexts.allL2s || chainTexts.default;
    case chainId.unichain:
      return chainTexts.unichain || chainTexts.allL2s || chainTexts.default;
    default:
      return chainTexts.default;
  }
};
