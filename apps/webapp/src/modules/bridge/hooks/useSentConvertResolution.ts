import { useCallback, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCallsStatus, getPublicClient } from '@wagmi/core';
import type { Hex } from 'viem';
import { useChains, useConfig } from 'wagmi';
import { guardChainId } from '../model/networks';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { resolveSentConverts, sentConvertPollMs } from '../tracking/sentConverts';
import { usePendingScope } from './usePendingScope';

const NONE: UnfinishedCctpSwap[] = [];

/**
 * Checks how the converts the connected account's stopped CCTP swaps sent
 * ended, only while one is unresolved, every 30 seconds and every 5 minutes
 * once they are over an hour old (`sentConvertPollMs`), so one sent from a tab
 * since closed is settled too: a bundle by asking the wallet, a convert sent
 * by hash by its receipt on the swap's L2, on a chain the app can switch to.
 * A convert linked since is checked at once.
 */
export function useSentConvertResolution() {
  const { scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const chainIds = useChains().map(chain => chain.id);
  const getSnapshot = useCallback(() => (scope ? cctpSwapStore.getSnapshot(scope) : NONE), [scope]);
  const swaps = useSyncExternalStore(cctpSwapStore.subscribe, getSnapshot);
  const sent = swaps
    .filter(swap => swap.convert)
    .map(swap => `${swap.convertBundled ? 'calls' : 'tx'}:${swap.convert}`)
    .join(',');

  useQuery({
    queryKey: ['bridge-sent-converts', scope, sent],
    queryFn: async () => {
      if (scope)
        await resolveSentConverts({
          store: cctpSwapStore,
          scope,
          callsStatus: id => getCallsStatus(config, { id }),
          receipt: async (network, hash) => {
            const chainId = guardChainId({ network, familyChainId, chainIds });
            const client = chainId === undefined ? undefined : getPublicClient(config, { chainId });
            if (!client) throw new Error(`No client for ${network}.`);
            return client.getTransactionReceipt({ hash: hash as Hex });
          }
        });
      return null;
    },
    enabled: !!scope && !!sent,
    refetchInterval: () => sentConvertPollMs(swaps, Date.now()),
    staleTime: 0,
    retry: false
  });
}
