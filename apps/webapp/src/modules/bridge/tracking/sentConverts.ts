import type { CctpSwapStore } from '../store/cctpSwapStore';
import { bundleOutcome } from './bundleAction';
import type { CallsStatus } from './recoverDeposits';

/**
 * Settles each convert a stopped CCTP swap sent as a wallet bundle from the
 * wallet's status of it, so it is resolved after the tab that sent it closed:
 * a bundle that ran drops the swap, one that failed or reverted unlinks the
 * convert so the swap is offered again, and one the wallet can't tell about
 * stays sent. A convert linked again meanwhile is left alone.
 */
export async function resolveSentConverts({
  store,
  scope,
  callsStatus
}: {
  store: CctpSwapStore;
  scope: string;
  callsStatus: (callsId: string) => Promise<CallsStatus | undefined>;
}): Promise<void> {
  const bundled = store.getSnapshot(scope).filter(swap => swap.convertBundled && swap.convert);
  await Promise.all(
    bundled.map(async ({ swapTxHash, convert }) => {
      let reported: CallsStatus | undefined;
      try {
        reported = await callsStatus(convert!);
      } catch {
        return;
      }
      const outcome = bundleOutcome(reported);
      const current = store.get(scope, swapTxHash);
      if (!outcome || !current?.convertBundled || current.convert !== convert) return;
      if (outcome.kind === 'ran') store.clear(scope, swapTxHash);
      else store.markConvert(scope, swapTxHash, undefined);
    })
  );
}
