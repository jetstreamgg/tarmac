import type { CctpSwapStore, UnfinishedCctpSwap } from '../store/cctpSwapStore';
import type { CctpL2NetworkId } from '../adapters/cctp/contracts';
import { bundleOutcome } from './bundleAction';
import type { CallsStatus } from './recoverDeposits';

/**
 * Settles each convert a stopped CCTP swap sent, so it is resolved after the
 * tab that sent it closed: one sent as a wallet bundle from the wallet's
 * status of it, one sent by hash from its receipt on the swap's L2. A convert
 * that ran drops the swap, one that failed or reverted is unlinked so the swap
 * is offered again, and one the wallet or the chain can't tell about yet (a
 * `receipt` that throws) stays sent. A convert linked again meanwhile is left
 * alone.
 */
export async function resolveSentConverts({
  store,
  scope,
  callsStatus,
  receipt
}: {
  store: CctpSwapStore;
  scope: string;
  callsStatus: (callsId: string) => Promise<CallsStatus | undefined>;
  /** No convert sent by hash is read without it. */
  receipt?: (network: CctpL2NetworkId, hash: string) => Promise<{ status: 'success' | 'reverted' }>;
}): Promise<void> {
  // Whether the convert ran; undefined while it can't be told.
  const ranOf = async ({ network, convert, convertBundled }: UnfinishedCctpSwap) => {
    if (convertBundled) {
      const outcome = bundleOutcome(await callsStatus(convert!));
      return outcome ? outcome.kind === 'ran' : undefined;
    }
    return receipt ? (await receipt(network, convert!)).status === 'success' : undefined;
  };
  const sent = store.getSnapshot(scope).filter(swap => swap.convert);
  await Promise.all(
    sent.map(async swap => {
      let ran: boolean | undefined;
      try {
        ran = await ranOf(swap);
      } catch {
        return;
      }
      const current = store.get(scope, swap.swapTxHash);
      if (ran === undefined || current?.convert !== swap.convert) return;
      if (ran) store.clear(scope, swap.swapTxHash);
      else store.markConvert(scope, swap.swapTxHash, undefined);
    })
  );
}
