import { useQuery } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { discoverNativeWithdrawals } from '../adapters/nativeWithdrawal/discovery';
import { lookupNativeWithdrawal } from '../adapters/nativeWithdrawal/lookup';
import type { NativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { getBridgeAdapter } from '../adapters/registry';
import { pendingBridgeStore } from '../store/pendingStore';
import { recoverWithdrawals } from '../tracking/recoverWithdrawals';
import { wagmiAdapterContext } from './adapterContext';
import { usePendingScope } from './usePendingScope';

const RECOVERY_INTERVAL_MS = 30 * 60_000;
// A scan that skipped an unreadable block range or L2 is retried sooner.
const PARTIAL_RETRY_MS = 2 * 60_000;

const NETWORKS: NativeDepositNetwork[] = ['base', 'optimism', 'unichain', 'arbitrum'];

// Per scope: withdrawals found settled, or not bridges, are never read again this session.
const settledByScope = new Map<string, Set<string>>();
const settledFor = (scope: string) => {
  const settled = settledByScope.get(scope) ?? new Set<string>();
  settledByScope.set(scope, settled);
  return settled;
};

/**
 * Scans each L2 for the connected account's recent native withdrawals to
 * Ethereum, sent or received, and adds the ones the store lacks, so their
 * cards offer the prove and finalize. Runs on connect and every 30 minutes (2
 * after a partial scan).
 */
export function useWithdrawalRecovery() {
  const { account, scope, familyChainId } = usePendingScope();
  const config = useConfig();

  useQuery({
    queryKey: ['bridge-withdrawal-recovery', scope],
    queryFn: async () => {
      if (!account || !scope) return { complete: true };
      const context = wagmiAdapterContext(config, familyChainId);
      const scans = await Promise.all(
        NETWORKS.map(async network => {
          const client = context.getClient(network);
          if (!client) return true;
          try {
            const { withdrawals, complete } = await discoverNativeWithdrawals({
              l2: client,
              network,
              account,
              toBlock: await client.getBlockNumber()
            });
            await recoverWithdrawals({
              store: pendingBridgeStore,
              scope,
              withdrawals,
              lookup: txHash => lookupNativeWithdrawal({ from: network, txHash, account, client }),
              now: Date.now,
              adapter: getBridgeAdapter('native'),
              context,
              settled: settledFor(scope)
            });
            return complete;
          } catch {
            return false;
          }
        })
      );
      return { complete: scans.every(Boolean) };
    },
    enabled: !!scope,
    staleTime: RECOVERY_INTERVAL_MS,
    refetchInterval: query =>
      query.state.data?.complete === false ? PARTIAL_RETRY_MS : RECOVERY_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false
  });
}
