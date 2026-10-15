import { useQuery } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { useConfig } from 'wagmi';
import { getPublicClient } from '@wagmi/core';
import { discoverNativeDeposits } from '../adapters/nativeDeposit/discovery';
import { getBridgeAdapter } from '../adapters/registry';
import { executedSafeTxHashes } from '../adapters/safe';
import type { AdapterContext } from '../adapters/types';
import { bridgeChainId } from '../model/networks';
import { pendingBridgeStore } from '../store/pendingStore';
import { recoverDeposits } from '../tracking/recoverDeposits';
import { usePendingScope } from './usePendingScope';

const RECOVERY_INTERVAL_MS = 30 * 60_000;
// A scan that skipped an unreadable block range is retried sooner.
const PARTIAL_RETRY_MS = 2 * 60_000;

// Per scope: deposits found settled are never read again this session.
const settledByScope = new Map<string, Set<string>>();
const settledFor = (scope: string) => {
  const settled = settledByScope.get(scope) ?? new Set<string>();
  settledByScope.set(scope, settled);
  return settled;
};

/**
 * Scans Ethereum for the connected account's recent native deposits and adds
 * the ones the store lacks, so the tracker picks them up. Runs on connect and
 * every 30 minutes (2 after a partial scan); a deposit found arrived is not
 * checked again.
 */
export function useDepositRecovery() {
  const { account, scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const ethereumChainId = bridgeChainId('ethereum', familyChainId);

  useQuery({
    queryKey: ['bridge-deposit-recovery', scope],
    queryFn: async () => {
      if (!account || !scope || ethereumChainId === undefined) return { complete: true };
      const l1 = getPublicClient(config, { chainId: ethereumChainId });
      if (!l1) return { complete: true };
      const context: AdapterContext = {
        getClient: network => {
          const chainId = bridgeChainId(network, familyChainId);
          return chainId === undefined ? undefined : getPublicClient(config, { chainId });
        }
      };
      const { deposits, complete } = await discoverNativeDeposits({
        l1,
        account,
        toBlock: await l1.getBlockNumber()
      });
      await recoverDeposits({
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
        context,
        settled: settledFor(scope),
        executedSafeTxHashes: async txHash => {
          try {
            return executedSafeTxHashes(
              (await l1.getTransactionReceipt({ hash: txHash as Hex })).logs,
              account
            );
          } catch {
            return undefined;
          }
        }
      });
      return { complete };
    },
    enabled: !!scope && ethereumChainId !== undefined,
    staleTime: RECOVERY_INTERVAL_MS,
    refetchInterval: query =>
      query.state.data?.complete === false ? PARTIAL_RETRY_MS : RECOVERY_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false
  });
}
