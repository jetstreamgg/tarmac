import { chainId as chainIdMap } from './chainId';

export enum ExplorerName {
  ETHERSCAN = 'Etherscan',
  COW_EXPLORER = 'CoW Explorer',
  BASESCAN = 'Basescan',
  ARBITRUM_EXPLORER = 'Arbiscan',
  SAFE = 'Safe Wallet',
  OPTIMISTIC_ETHERSCAN = 'OP Explorer',
  UNISCAN = 'Uniscan'
}

export const getExplorerName = (chainId: number, isSafeWallet: boolean) => {
  if (isSafeWallet) {
    return ExplorerName.SAFE;
  }

  switch (chainId) {
    case chainIdMap.base:
    case chainIdMap.tenderlyBase:
      return ExplorerName.BASESCAN;
    case chainIdMap.arbitrum:
    case chainIdMap.tenderlyArbitrum:
      return ExplorerName.ARBITRUM_EXPLORER;
    case chainIdMap.optimism:
      return ExplorerName.OPTIMISTIC_ETHERSCAN;
    case chainIdMap.unichain:
      return ExplorerName.UNISCAN;
    case chainIdMap.mainnet:
    case chainIdMap.sepolia:
    case chainIdMap.tenderly:
    default:
      return ExplorerName.ETHERSCAN;
  }
};
