import { chainId as chainIdMap } from './chainId';
import { BaseChain } from './icons/BaseChain';
import { EthereumChain } from './icons/EthereumChain';
import { ArbitrumChain } from './icons/ArbitrumChain';
import { OptimismChain } from './icons/OptimismChain';
import { UnichainChain } from './icons/UnichainChain';

//TODO: handle optimism and unichain
export const getChainIcon = (chainId: number, className?: string) =>
  chainId === chainIdMap.base || chainId === chainIdMap.tenderlyBase ? (
    <BaseChain className={className} />
  ) : chainId === chainIdMap.arbitrum ? (
    <ArbitrumChain className={className} />
  ) : chainId === chainIdMap.optimism ? (
    <OptimismChain className={className} />
  ) : chainId === chainIdMap.unichain ? (
    <UnichainChain className={className} />
  ) : (
    <EthereumChain className={className} />
  );
