import type { Config } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import type { AdapterContext } from '../adapters/types';
import { testnetAttestationReader } from '../adapters/cctp/testnetAttester';
import { bridgeChainId, usesL2Testnets } from '../model/networks';

/**
 * Reads each bridge network through wagmi's client for its chain in the
 * connected family. Circle never sees the Tenderly testnets, so their burns
 * are attested by the test attester instead.
 */
export const wagmiAdapterContext = (config: Config, familyChainId: number): AdapterContext => {
  const getClient: AdapterContext['getClient'] = network => {
    const chainId = bridgeChainId(network, familyChainId);
    return chainId === undefined ? undefined : getPublicClient(config, { chainId });
  };
  return {
    getClient,
    readCctpAttestations: usesL2Testnets(familyChainId) ? testnetAttestationReader(getClient) : undefined
  };
};
