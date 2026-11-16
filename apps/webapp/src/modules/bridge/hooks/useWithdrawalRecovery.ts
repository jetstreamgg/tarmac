import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { discoverNativeWithdrawals } from '../adapters/nativeWithdrawal/discovery';
import { lookupNativeWithdrawal } from '../adapters/nativeWithdrawal/lookup';
import type { NativeDepositNetwork } from '../adapters/nativeDeposit/contracts';
import { getBridgeAdapter } from '../adapters/registry';
import { pendingBridgeStore } from '../store/pendingStore';
import { lastCompleteScan, markCompleteScan } from '../store/recoveryScanStamp';
import { clearSendIntent, recentSendIntents, sendIntentScanId } from '../store/sendIntentStore';
import { recoverWithdrawals } from '../tracking/recoverWithdrawals';
import { wagmiAdapterContext } from './adapterContext';
import { usePendingScope } from './usePendingScope';
import {
  PARTIAL_RETRY_MS,
  RECOVERY_INTERVAL_MS,
  bundleScanDue,
  bundleScannedAt,
  markBundleScanned,
  retryDelay,
  scannedRecently,
  settledFor
} from './recoveryScan';

// An L2 left unread (a skipped block range, or no head) is retried alone, with the shared backoff.
const SCAN_KIND = 'withdrawal';

const NETWORKS: NativeDepositNetwork[] = ['base', 'optimism', 'unichain', 'arbitrum'];

type RecoveryScan = {
  unread: NativeDepositNetwork[];
  retries: number;
  /** When every L2 was last due a read: this load's scan, or an earlier load's complete one. */
  fullAt: number;
};

const fullDelay = (scan: RecoveryScan) =>
  scan.unread.length ? retryDelay(scan.retries) : RECOVERY_INTERVAL_MS;

// A tick may run a little early.
const TICK_SLACK_MS = 5_000;

// A found withdrawal's time is its block's: the device that asked for its signature may run this far ahead.
const INTENT_SKEW_MS = 5 * 60_000;

const lostSignatures = (scope: string, now: number) =>
  recentSendIntents(scope, now).filter((intent): intent is { network: NativeDepositNetwork; at: number } =>
    (NETWORKS as string[]).includes(intent.network)
  );

/**
 * Scans each L2 for the connected account's recent native withdrawals to
 * Ethereum, sent or received, and adds the ones the store lacks, so their
 * cards offer the prove and finalize. Runs on connect, unless a load in the
 * last 30 minutes read everything, and 30 minutes after the last complete
 * scan; an L2 left unread is retried alone after 2 minutes, then 4, 8 and so
 * on. An L2 whose withdrawal signature a page lost (a reload mid-signature)
 * is read alone 2, 6, 14 and 30 minutes after it was asked for. Reads nothing
 * while not `enabled`.
 */
export function useWithdrawalRecovery(enabled = true) {
  const { account, scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const queryClient = useQueryClient();
  const queryKey = ['bridge-withdrawal-recovery', scope];

  useQuery({
    queryKey,
    queryFn: async (): Promise<RecoveryScan> => {
      const at = Date.now();
      const idle = { unread: [], retries: 0, fullAt: at };
      if (!account || !scope) return idle;
      const previous = queryClient.getQueryData<RecoveryScan>(queryKey);
      const fullDue = previous
        ? at - previous.fullAt >= fullDelay(previous) - TICK_SLACK_MS
        : !scannedRecently(SCAN_KIND, scope, true);
      const intents = lostSignatures(scope, at);
      const lost = intents.filter(intent =>
        bundleScanDue(intent.at, bundleScannedAt(scope, sendIntentScanId(intent)), at)
      );
      const full = fullDue ? (previous?.unread.length ? previous.unread : NETWORKS) : [];
      const networks = [...new Set([...full, ...lost.map(intent => intent.network)])];
      // Skipped on a load: the next full read counts from the earlier load's.
      // A stamp ahead of this clock counts as now.
      const notDue = previous ?? { ...idle, fullAt: Math.min(lastCompleteScan(SCAN_KIND, scope) ?? at, at) };
      if (networks.length === 0) return notDue;
      const known = new Set(pendingBridgeStore.getSnapshot(scope).map(bridge => bridge.id));
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
              // Withdrawals found not to be bridges are kept here too.
              settled: settledFor(SCAN_KIND, scope)
            });
            return complete;
          } catch {
            return false;
          }
        })
      );
      const read = (network: NativeDepositNetwork) => scans[networks.indexOf(network)];
      const readIntents = intents.filter(intent => networks.includes(intent.network) && read(intent.network));
      markBundleScanned(scope, readIntents.map(sendIntentScanId), Date.now());
      // A withdrawal found since the signature was asked for: it was sent.
      const added = pendingBridgeStore.getSnapshot(scope).filter(bridge => !known.has(bridge.id));
      for (const intent of readIntents)
        if (
          added.some(
            bridge => bridge.from === intent.network && bridge.startedAt >= intent.at - INTENT_SKEW_MS
          )
        )
          clearSendIntent(scope, intent.network, intent.at);
      if (!fullDue) return notDue;
      const unread = full.filter(network => !read(network));
      if (unread.length === 0) markCompleteScan(SCAN_KIND, scope, Date.now());
      return {
        unread,
        retries: unread.length ? (previous?.unread.length ? previous.retries : 0) + 1 : 0,
        fullAt: Date.now()
      };
    },
    enabled: enabled && !!scope,
    staleTime: RECOVERY_INTERVAL_MS,
    refetchInterval: query => {
      const scan = query.state.data;
      const now = Date.now();
      // The time left since the last full read: a pause doesn't push the next one back.
      const left = scan ? fullDelay(scan) - (now - scan.fullAt) : RECOVERY_INTERVAL_MS;
      const next = left > 0 ? Math.max(left, 1_000) : scan ? fullDelay(scan) : RECOVERY_INTERVAL_MS;
      return scope && lostSignatures(scope, now).length ? Math.min(next, PARTIAL_RETRY_MS) : next;
    },
    refetchOnWindowFocus: false,
    retry: false
  });
}
