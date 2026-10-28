import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { discoverNativeWithdrawals } from '../adapters/nativeWithdrawal/discovery';
import { lookupNativeWithdrawal } from '../adapters/nativeWithdrawal/lookup';
import type { NativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { getBridgeAdapter } from '../adapters/registry';
import { pendingBridgeStore } from '../store/pendingStore';
import { lastCompleteScan, markCompleteScan } from '../store/recoveryScanStamp';
import { recoverWithdrawals } from '../tracking/recoverWithdrawals';
import { wagmiAdapterContext } from './adapterContext';
import { usePendingScope } from './usePendingScope';

const RECOVERY_INTERVAL_MS = 30 * 60_000;
// An L2 left unread (a skipped block range, or no head) is retried alone, sooner, doubling up to the interval.
const PARTIAL_RETRY_MS = 2 * 60_000;
const SCAN_KIND = 'withdrawal';

const NETWORKS: NativeDepositNetwork[] = ['base', 'optimism', 'unichain', 'arbitrum'];

type RecoveryScan = { unread: NativeDepositNetwork[]; retries: number };
const retryDelay = (retries: number) => Math.min(PARTIAL_RETRY_MS * 2 ** (retries - 1), RECOVERY_INTERVAL_MS);

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
 * cards offer the prove and finalize. Runs on connect, unless a load in the
 * last 30 minutes read everything, and every 30 minutes; an L2 left unread is
 * retried alone after 2 minutes, then 4, 8 and so on.
 */
export function useWithdrawalRecovery() {
  const { account, scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const queryClient = useQueryClient();
  const queryKey = ['bridge-withdrawal-recovery', scope];

  useQuery({
    queryKey,
    queryFn: async (): Promise<RecoveryScan> => {
      if (!account || !scope) return { unread: [], retries: 0 };
      const previous = queryClient.getQueryData<RecoveryScan>(queryKey);
      const stamp = lastCompleteScan(SCAN_KIND, scope);
      if (!previous && stamp !== undefined && Date.now() - stamp < RECOVERY_INTERVAL_MS) {
        return { unread: [], retries: 0 };
      }
      const networks = previous?.unread.length ? previous.unread : NETWORKS;
      const context = wagmiAdapterContext(config, familyChainId);
      const scans = await Promise.all(
        networks.map(async network => {
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
      const unread = networks.filter((_, index) => !scans[index]);
      if (unread.length === 0) markCompleteScan(SCAN_KIND, scope, Date.now());
      return { unread, retries: unread.length ? (previous?.unread.length ? previous.retries : 0) + 1 : 0 };
    },
    enabled: !!scope,
    staleTime: RECOVERY_INTERVAL_MS,
    refetchInterval: query =>
      query.state.data?.unread.length ? retryDelay(query.state.data.retries) : RECOVERY_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false
  });
}
