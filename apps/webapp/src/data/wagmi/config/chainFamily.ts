import { mainnet, base, arbitrum, optimism, unichain } from 'wagmi/chains';
import { isTestnetId } from '@/utils/isTestnetId';
import { chainId } from '@/utils/chainId';

/**
 * The chain family the connected chain belongs to: all production networks, or
 * only the Tenderly fork when connected to it. Lives in its own module (rather
 * than config.default, which re-exports it) so the engine layer can import it
 * without dragging the wallet connectors instantiated there at module scope.
 */
export const getSupportedChainIds = (connectedChainId: number): number[] => {
  if (isTestnetId(connectedChainId)) {
    return [chainId.tenderly];
  }
  return [mainnet.id, base.id, arbitrum.id, optimism.id, unichain.id];
};
