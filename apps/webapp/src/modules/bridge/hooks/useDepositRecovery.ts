import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { useConfig } from 'wagmi';
import { getCallsStatus, getPublicClient } from 'wagmi/actions';
import { discoverNativeDeposits, type DiscoveredDeposit } from '../adapters/nativeDeposit/discovery';
import { getBridgeAdapter } from '../adapters/registry';
import { executedSafeTxHashes } from '../adapters/safe';
import { bridgeChainId, type BridgeNetworkId } from '../model/networks';
import { isSettled } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import { pendingBridgeStore } from '../store/pendingStore';
import { markCompleteScan } from '../store/recoveryScanStamp';
import { recoverDeposits } from '../tracking/recoverDeposits';
import { wagmiAdapterContext } from './adapterContext';
import { useBridgeHistory } from './useBridgeHistory';
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

const SCAN_KIND = 'deposit';
// A timer may fire a moment before its time.
const TICK_SLACK_MS = 5_000;

type RecoveryScan = {
  complete: boolean;
  retries: number;
  /** When the whole window was last read, or found read by an earlier load. */
  fullAt: number;
  /** How far the device clock ran ahead of Ethereum's at the last scan. */
  offset?: number;
};

const isUnminedBundle = (bridge: PendingBridge) => !!bridge.bundleId && !bridge.txHash && !isSettled(bridge);

// A scan that skipped an unreadable block range is retried with the shared backoff.
const fullDelay = (scan: RecoveryScan) => (scan.complete ? RECOVERY_INTERVAL_MS : retryDelay(scan.retries));

/**
 * Scans Ethereum for the connected account's recent native deposits and adds
 * the ones the store lacks, so the tracker picks them up. Reads the whole
 * window on connect, unless a load in the last 30 minutes read everything and
 * no bundle lacks its hash, and every 30 minutes (sooner after a partial
 * scan); a deposit found arrived is not checked again. While a wallet bundle
 * has no hash, asks the wallet every 2 minutes, and reads the newest range 2,
 * 6, 14 and 30 minutes after a deposit bundle's send, and when the launch asks.
 * Reads nothing while not `enabled`.
 */
export function useDepositRecovery(enabled = true) {
  const { account, scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const ethereumChainId = bridgeChainId('ethereum', familyChainId);
  const queryClient = useQueryClient();
  const queryKey = ['bridge-deposit-recovery', scope];
  const bundleWaiting = useBridgeHistory().some(isUnminedBundle);

  useQuery({
    queryKey,
    queryFn: async (): Promise<RecoveryScan> => {
      const at = Date.now();
      const idle = { complete: true, retries: 0, fullAt: at };
      if (!account || !scope || ethereumChainId === undefined) return idle;
      const previous = queryClient.getQueryData<RecoveryScan>(queryKey);
      const bundles = pendingBridgeStore.getSnapshot(scope).filter(isUnminedBundle);
      const sent = bundles.filter(bridge => bridge.from === 'ethereum');
      const fullDue = previous
        ? at - previous.fullAt >= fullDelay(previous) - TICK_SLACK_MS
        : !scannedRecently(SCAN_KIND, scope, true) || bundles.length > 0;
      const recentDue =
        !fullDue &&
        // The launch asks when a bundle may have sent a deposit the wallet didn't report.
        (queryClient.getQueryState(queryKey)?.isInvalidated === true ||
          sent.some(bridge => bundleScanDue(bridge.startedAt, bundleScannedAt(scope, bridge.id), at)));
      if (!fullDue && !recentDue && bundles.length === 0) return previous ?? idle;
      const l1 = getPublicClient(config, { chainId: ethereumChainId });
      if (!l1) return idle;
      const context = wagmiAdapterContext(config, familyChainId);
      // A CCTP bundle's burn mined on its L2; no block number reads the latest.
      const blockTime = async (blockNumber?: bigint, network: BridgeNetworkId = 'ethereum') => {
        const client = network === 'ethereum' ? l1 : context.getClient(network);
        if (!client) return undefined;
        try {
          const block =
            blockNumber === undefined ? await client.getBlock() : await client.getBlock({ blockNumber });
          return Number(block.timestamp) * 1000;
        } catch {
          return undefined;
        }
      };
      let deposits: DiscoveredDeposit[] = [];
      let complete = false;
      let offset = previous?.offset;
      // Between scans only the wallet is asked, with the chain's time as last read.
      let chainNow = offset === undefined ? undefined : at - offset;
      if (fullDue || recentDue) {
        const toBlock = await l1.getBlockNumber();
        ({ deposits, complete } = await discoverNativeDeposits({
          l1,
          account,
          toBlock,
          ...(!fullDue && { recentOnly: true })
        }));
        chainNow = await blockTime(toBlock);
        if (chainNow !== undefined) offset = Date.now() - chainNow;
        if (complete)
          markBundleScanned(
            scope,
            sent.map(bridge => bridge.id),
            Date.now()
          );
      }
      await recoverDeposits({
        store: pendingBridgeStore,
        scope,
        account,
        deposits,
        now: Date.now,
        blockTime,
        chainNow,
        chainNowOn: network => blockTime(undefined, network),
        callsStatus: async id => {
          try {
            return await getCallsStatus(config, { id });
          } catch {
            return undefined;
          }
        },
        adapter: getBridgeAdapter('native'),
        context,
        settled: settledFor(SCAN_KIND, scope),
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
      if (!fullDue) return { ...(previous ?? idle), ...(offset !== undefined && { offset }) };
      if (complete) markCompleteScan(SCAN_KIND, scope, Date.now());
      return {
        complete,
        retries: complete ? 0 : (previous?.complete === false ? previous.retries : 0) + 1,
        fullAt: Date.now(),
        ...(offset !== undefined && { offset })
      };
    },
    enabled: enabled && !!scope && ethereumChainId !== undefined,
    staleTime: RECOVERY_INTERVAL_MS,
    refetchInterval: query => {
      if (bundleWaiting) return PARTIAL_RETRY_MS;
      const scan = query.state.data;
      if (!scan) return RECOVERY_INTERVAL_MS;
      // The time left to the next whole read: the wallet's ticks don't push it back.
      const left = fullDelay(scan) - (Date.now() - scan.fullAt);
      return left > 0 ? Math.max(left, 1_000) : fullDelay(scan);
    },
    refetchOnWindowFocus: false,
    retry: false
  });
}
