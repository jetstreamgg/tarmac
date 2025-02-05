import { chainId as chainIdMap } from './chainId';

export enum ExplorerName {
  ETHERSCAN = 'Etherscan',
  COW_EXPLORER = 'CoW Explorer',
  BASESCAN = 'Basescan',
  ARBITRUM_EXPLORER = 'Arbiscan'
}

export const getExplorerName = (chainId: number) => {
  switch (chainId) {
    case chainIdMap.base:
    case chainIdMap.tenderlyBase:
      return ExplorerName.BASESCAN;
    case chainIdMap.arbitrum:
    case chainIdMap.tenderlyArbitrum:
      return ExplorerName.ARBITRUM_EXPLORER;
    case chainIdMap.mainnet:
    case chainIdMap.sepolia:
    case chainIdMap.tenderly:
    default:
      return ExplorerName.ETHERSCAN;
  }
};
