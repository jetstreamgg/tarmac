import { mainnet, base, arbitrum, optimism, unichain } from 'wagmi/chains';
import { chainId, isForkChainId } from '@/utils/chainId';
import { forkL2ChainIds } from './forkChains';

/**
 * The chain family the connected chain belongs to: all production networks, or
 * the Tenderly forks (Ethereum plus any configured fork L2s) when connected to
 * one of them. Lives in its own module (rather
 * than config.default, which re-exports it) so the engine layer can import it
 * without dragging the wallet connectors instantiated there at module scope.
 */
export const getSupportedChainIds = (connectedChainId: number): number[] => {
  if (isForkChainId(connectedChainId)) {
    return [chainId.tenderly, ...forkL2ChainIds];
  }
  return [mainnet.id, base.id, arbitrum.id, optimism.id, unichain.id];
};
