import { useQuery } from '@tanstack/react-query';
import { useConfig } from 'wagmi';
import { CCTP_L2_NETWORKS } from '../adapters/cctp/contracts';
import { awaitsBurnScan } from '../model/pendingTransitions';
import { pendingBridgeStore } from '../store/pendingStore';
import { recoverCctpBundles } from '../tracking/recoverCctpBundles';
import { wagmiAdapterContext } from './adapterContext';
import { PARTIAL_RETRY_MS, bundleScanDue, bundleScannedAt, markBundleScanned } from './recoveryScan';
import { useBridgeHistory } from './useBridgeHistory';
import { usePendingScope } from './usePendingScope';

/**
 * Reads each L2 where a CCTP wallet bundle has no hash for the burn it sent:
 * 2, 6, 14 and 30 minutes after the send, then every 30 minutes, and on a load
 * that finds the card older than 2 minutes. An L2 that can't be read is tried
 * again 2 minutes later. Reads nothing while no such card waits.
 */
export function useCctpBundleRecovery() {
  const { account, scope, familyChainId } = usePendingScope();
  const config = useConfig();
  const waiting = useBridgeHistory().some(awaitsBurnScan);

  useQuery({
    queryKey: ['bridge-cctp-bundle-recovery', scope],
    queryFn: async () => {
      if (!account || !scope) return 0;
      const at = Date.now();
      const context = wagmiAdapterContext(config, familyChainId);
      const cards = pendingBridgeStore.getSnapshot(scope).filter(awaitsBurnScan);
      await Promise.all(
        CCTP_L2_NETWORKS.map(async network => {
          const sent = cards.filter(card => card.from === network);
          if (!sent.some(card => bundleScanDue(card.startedAt, bundleScannedAt(scope, card.id), at))) return;
          const client = context.getClient(network);
          if (!client) return;
          const read = await recoverCctpBundles({
            store: pendingBridgeStore,
            scope,
            account,
            network,
            client,
            now: Date.now
          }).catch(() => false);
          if (read)
            markBundleScanned(
              scope,
              sent.map(card => card.id),
              Date.now()
            );
        })
      );
      return at;
    },
    enabled: !!scope && !!account && waiting,
    refetchInterval: PARTIAL_RETRY_MS,
    refetchOnWindowFocus: false,
    retry: false
  });
}
