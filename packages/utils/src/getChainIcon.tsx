import { chainId as chainIdMap } from './chainId';
import { BaseChain } from './icons/BaseChain';
import { EthereumChain } from './icons/EthereumChain';

export const getChainIcon = (chainId: number, className?: string) =>
  chainId === chainIdMap.base || chainId === chainIdMap.tenderlyBase ? (
    <BaseChain className={className} />
  ) : (
    <EthereumChain className={className} />
  );
