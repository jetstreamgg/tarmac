import type { Config } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import type { AdapterContext } from '../adapters/types';
import { bridgeChainId } from '../model/networks';

/** Reads each bridge network through wagmi's client for its chain in the connected family. */
export const wagmiAdapterContext = (config: Config, familyChainId: number): AdapterContext => ({
  getClient: network => {
    const chainId = bridgeChainId(network, familyChainId);
    return chainId === undefined ? undefined : getPublicClient(config, { chainId });
  }
});
