import { useQuery } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { discoverNativeDeposits } from '../adapters/nativeDeposit/discovery';
import { getBridgeAdapter } from '../adapters/registry';
import type { AdapterContext } from '../adapters/types';
import { bridgeChainId } from '../model/networks';
import { pendingBridgeStore } from '../store/pendingStore';
import { recoverDeposits } from '../tracking/recoverDeposits';
import { usePendingScope } from './usePendingScope';

const RECOVERY_INTERVAL_MS = 30 * 60_000;

/**
 * Scans Ethereum for the connected account's recent native deposits and adds
 * the ones the store lacks, so the tracker picks them up. Runs on connect and
 * every 30 minutes.
 */
export function useDepositRecovery() {
  const { account, scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const ethereumChainId = bridgeChainId('ethereum', familyChainId);

  useQuery({
    queryKey: ['bridge-deposit-recovery', scope],
    queryFn: async () => {
      if (!account || !scope || ethereumChainId === undefined) return 0;
      const l1 = getPublicClient(config, { chainId: ethereumChainId });
      if (!l1) return 0;
      const context: AdapterContext = {
        getClient: network => {
          const chainId = bridgeChainId(network, familyChainId);
          return chainId === undefined ? undefined : getPublicClient(config, { chainId });
        }
      };
      const { deposits } = await discoverNativeDeposits({
        l1,
        account,
        toBlock: await l1.getBlockNumber()
      });
      return recoverDeposits({
        store: pendingBridgeStore,
        scope,
        account,
        deposits,
        now: Date.now,
        blockTime: async blockNumber => {
          try {
            return Number((await l1.getBlock({ blockNumber })).timestamp) * 1000;
          } catch {
            return undefined;
          }
        },
        adapter: getBridgeAdapter('native'),
        context
      });
    },
    enabled: !!scope && ethereumChainId !== undefined,
    staleTime: RECOVERY_INTERVAL_MS,
    refetchInterval: RECOVERY_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false
  });
}
