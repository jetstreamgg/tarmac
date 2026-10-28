import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Hex } from 'viem';
import { useConfig } from 'wagmi';
import { getCallsStatus, getPublicClient } from 'wagmi/actions';
import { discoverNativeDeposits } from '../adapters/nativeDeposit/discovery';
import { getBridgeAdapter } from '../adapters/registry';
import { executedSafeTxHashes } from '../adapters/safe';
import { bridgeChainId, type BridgeNetworkId } from '../model/networks';
import { isSettled } from '../model/pendingTransitions';
import { pendingBridgeStore } from '../store/pendingStore';
import { lastCompleteScan, markCompleteScan } from '../store/recoveryScanStamp';
import { recoverDeposits } from '../tracking/recoverDeposits';
import { wagmiAdapterContext } from './adapterContext';
import { usePendingScope } from './usePendingScope';

const RECOVERY_INTERVAL_MS = 30 * 60_000;
// A bundle still without its hash is read again every 2 minutes; a scan that skipped an
// unreadable block range is retried after 2, then 4, 8 and so on up to the interval.
const PARTIAL_RETRY_MS = 2 * 60_000;
const SCAN_KIND = 'deposit';

type RecoveryScan = { complete: boolean; retries: number };
const retryDelay = (retries: number) => Math.min(PARTIAL_RETRY_MS * 2 ** (retries - 1), RECOVERY_INTERVAL_MS);

// Per scope: deposits found settled are never read again this session.
const settledByScope = new Map<string, Set<string>>();
const settledFor = (scope: string) => {
  const settled = settledByScope.get(scope) ?? new Set<string>();
  settledByScope.set(scope, settled);
  return settled;
};

const hasUnminedBundle = (scope: string) =>
  pendingBridgeStore
    .getSnapshot(scope)
    .some(bridge => bridge.bundleId && !bridge.txHash && !isSettled(bridge));

/**
 * Scans Ethereum for the connected account's recent native deposits and adds
 * the ones the store lacks, so the tracker picks them up. Runs on connect,
 * unless a load in the last 30 minutes read everything and no bundle lacks its
 * hash, and every 30 minutes (sooner after a partial scan or while a bundle has
 * no hash); a deposit found arrived is not checked again.
 */
export function useDepositRecovery() {
  const { account, scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const ethereumChainId = bridgeChainId('ethereum', familyChainId);
  const queryClient = useQueryClient();
  const queryKey = ['bridge-deposit-recovery', scope];

  useQuery({
    queryKey,
    queryFn: async (): Promise<RecoveryScan> => {
      if (!account || !scope || ethereumChainId === undefined) return { complete: true, retries: 0 };
      const previous = queryClient.getQueryData<RecoveryScan>(queryKey);
      const stamp = lastCompleteScan(SCAN_KIND, scope);
      if (
        !previous &&
        stamp !== undefined &&
        Date.now() - stamp < RECOVERY_INTERVAL_MS &&
        !hasUnminedBundle(scope)
      ) {
        return { complete: true, retries: 0 };
      }
      const l1 = getPublicClient(config, { chainId: ethereumChainId });
      if (!l1) return { complete: true, retries: 0 };
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
      const toBlock = await l1.getBlockNumber();
      const { deposits, complete } = await discoverNativeDeposits({ l1, account, toBlock });
      await recoverDeposits({
        store: pendingBridgeStore,
        scope,
        account,
        deposits,
        now: Date.now,
        blockTime,
        chainNow: await blockTime(toBlock),
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
      if (complete) markCompleteScan(SCAN_KIND, scope, Date.now());
      return { complete, retries: complete ? 0 : (previous?.complete === false ? previous.retries : 0) + 1 };
    },
    enabled: !!scope && ethereumChainId !== undefined,
    staleTime: RECOVERY_INTERVAL_MS,
    refetchInterval: query =>
      !!scope && hasUnminedBundle(scope)
        ? PARTIAL_RETRY_MS
        : query.state.data?.complete === false
          ? retryDelay(query.state.data.retries)
          : RECOVERY_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false
  });
}
