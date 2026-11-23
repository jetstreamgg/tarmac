import { chainId as chainIdMap, realChainId } from './chainId';
import { BaseChain } from './icons/BaseChain';
import { EthereumChain } from './icons/EthereumChain';
import { ArbitrumChain } from './icons/ArbitrumChain';
import { OptimismChain } from './icons/OptimismChain';
import { UnichainChain } from './icons/UnichainChain';

//TODO: handle optimism and unichain
export const getChainIcon = (forkOrRealId: number, className?: string) => {
  const chainId = realChainId(forkOrRealId);
  return chainId === chainIdMap.base ? (
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
};
