import type { Config } from 'wagmi';
import { getClient } from 'wagmi/actions';
import { publicActions, type Client } from 'viem';
import { forkL2ChainIds } from '@/data/wagmi/config/forkChains';
import { chainId as chainIdMap } from '@/utils/chainId';
import type { AdapterContext, ChainReader } from '../adapters/types';
import { bridgeChainId } from '../model/networks';

// wagmi's getPublicClient extends its client anew on each call; one reader per client keeps it stable.
const readers = new WeakMap<Client, ChainReader>();

/** Reads each bridge network through wagmi's client for its chain in the connected family. */
export const wagmiAdapterContext = (
  config: Config,
  familyChainId: number,
  forkL2Ids: number[] = forkL2ChainIds
): AdapterContext => ({
  getClient: network => {
    const chainId = bridgeChainId(network, familyChainId, forkL2Ids);
    const client = chainId === undefined ? undefined : getClient(config, { chainId });
    if (!client) return undefined;
    if (!readers.has(client)) readers.set(client, client.extend(publicActions));
    return readers.get(client);
  },
  onTenderlyFork: familyChainId === chainIdMap.tenderly && forkL2Ids.length > 0
});
