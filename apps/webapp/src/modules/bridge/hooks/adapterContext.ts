import type { Config } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { forkL2ChainIds } from '@/data/wagmi/config/forkChains';
import { chainId as chainIdMap } from '@/utils/chainId';
import type { AdapterContext } from '../adapters/types';
import { bridgeChainId } from '../model/networks';

/** Reads each bridge network through wagmi's client for its chain in the connected family. */
export const wagmiAdapterContext = (
  config: Config,
  familyChainId: number,
  forkL2Ids: number[] = forkL2ChainIds
): AdapterContext => ({
  getClient: network => {
    const chainId = bridgeChainId(network, familyChainId, forkL2Ids);
    return chainId === undefined ? undefined : getPublicClient(config, { chainId });
  },
  onTenderlyFork: familyChainId === chainIdMap.tenderly && forkL2Ids.length > 0
});
