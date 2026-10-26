import { useCallback, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCallsStatus } from '@wagmi/core';
import { useConfig } from 'wagmi';
import { cctpSwapStore, type UnfinishedCctpSwap } from '../store/cctpSwapStore';
import { resolveSentConverts } from '../tracking/sentConverts';
import { usePendingScope } from './usePendingScope';

const POLL_MS = 30_000;
const NONE: UnfinishedCctpSwap[] = [];

/**
 * Asks the wallet every 30 seconds how the converts the connected account's
 * stopped CCTP swaps sent as a bundle ended, only while one is unresolved, so
 * one sent from a tab since closed is settled too.
 */
export function useSentConvertResolution() {
  const { scope } = usePendingScope();
  const config = useConfig();
  const getSnapshot = useCallback(() => (scope ? cctpSwapStore.getSnapshot(scope) : NONE), [scope]);
  const unresolved = useSyncExternalStore(cctpSwapStore.subscribe, getSnapshot).some(
    swap => swap.convertBundled
  );

  useQuery({
    queryKey: ['bridge-sent-converts', scope],
    queryFn: async () => {
      if (scope)
        await resolveSentConverts({
          store: cctpSwapStore,
          scope,
          callsStatus: id => getCallsStatus(config, { id })
        });
      return null;
    },
    enabled: !!scope && unresolved,
    refetchInterval: POLL_MS,
    staleTime: 0,
    retry: false
  });
}
