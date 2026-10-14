import { useMemo } from 'react';
import { useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import type { PublicClient } from 'viem';

/**
 * Clients for every configured chain other than `chainId`, in config order — where the
 * batch executor's code is read from when the chain at hand has no deployment of it.
 */
export function useBatchExecutorFallbackClients(chainId: number): readonly PublicClient[] {
  const config = useConfig();
  return useMemo(
    () =>
      config.chains
        .filter(chain => chain.id !== chainId)
        .map(chain => getPublicClient(config, { chainId: chain.id }))
        .filter((client): client is NonNullable<typeof client> => !!client) as readonly PublicClient[],
    [config, chainId]
  );
}
