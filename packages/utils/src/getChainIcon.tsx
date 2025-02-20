import { chainId as chainIdMap } from './chainId';
import { BaseChain } from './icons/BaseChain';
import { EthereumChain } from './icons/EthereumChain';
import { ArbitrumChain } from './icons/ArbitrumChain';

export const getChainIcon = (chainId: number, className?: string) =>
  chainId === chainIdMap.base || chainId === chainIdMap.tenderlyBase ? (
    <BaseChain className={className} />
  ) : chainId === chainIdMap.arbitrum || chainId === chainIdMap.tenderlyArbitrum ? (
    <ArbitrumChain className={className} />
  ) : (
    <EthereumChain className={className} />
  );
