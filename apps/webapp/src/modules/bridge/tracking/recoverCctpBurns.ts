import type { Hex } from 'viem';
import { cctpBurnAmount } from '../adapters/cctp/calls';
import { CCTP_DOMAIN, addressToBytes32, type CctpL2NetworkId } from '../adapters/cctp/contracts';
import type { DiscoveredBurn } from '../adapters/cctp/discovery';
import type { CctpBurnLookup } from '../adapters/cctp/lookup';
import type { BridgeAdapter } from '../adapters/types';
import { applyProgress, isSettled } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import type { CctpSwapStore } from '../store/cctpSwapStore';
import type { PendingBridgeStore } from '../store/pendingStore';
import { CLOCK_SKEW_MS } from './recoverDeposits';

const storesHash = (stored: PendingBridge[], hash: string) =>
  stored.some(bridge => bridge.id.toLowerCase() === hash || bridge.txHash?.toLowerCase() === hash);

/** A card with no hash yet (a wallet bundle, a queued Safe tx) whose burn this may be: its own reader resolves it. */
const mayBeUnresolved = (card: PendingBridge, network: CctpL2NetworkId, burn: DiscoveredBurn) =>
  card.routeKind === 'cctp' &&
  card.from === network &&
  card.to === 'ethereum' &&
  !card.txHash &&
  (!!card.bundleId || !!card.safeTxHash) &&
  !isSettled(card) &&
  cctpBurnAmount(card.amount) === burn.amount &&
  addressToBytes32((card.recipient ?? card.account) as Hex) === burn.mintRecipient.toLowerCase();

/**
 * Adds the CCTP burns to Ethereum that the store lacks, read for a burn
 * signature a reload lost before the page recorded the send, so each is
 * claimed from its card. Each is
 * read with `lookup`, as the manual form does. A burn a card with no hash yet
 * may own is left to that card. A stopped swap of the same USDC and recipient
 * is linked to the burn, so it isn't offered again. One that was claimed,
 * failed or isn't a bridge joins `settled`, which later runs skip; a read
 * error leaves it for the next run. Returns how many it added.
 */
export async function recoverCctpBurns({
  store,
  swaps,
  scope,
  network,
  burns,
  lookup,
  now,
  adapter,
  context,
  settled
}: {
  store: Pick<PendingBridgeStore, 'getSnapshot' | 'upsert'>;
  swaps: Pick<CctpSwapStore, 'getSnapshot' | 'markBurn'>;
  scope: string;
  network: CctpL2NetworkId;
  burns: DiscoveredBurn[];
  lookup: (txHash: Hex) => Promise<CctpBurnLookup>;
  now: () => number;
  adapter: BridgeAdapter;
  context: Parameters<BridgeAdapter['checkProgress']>[2];
  /** Lowercase hashes of burns that were claimed, failed or aren't bridges. */
  settled: Set<string>;
}): Promise<number> {
  const stored = store.getSnapshot(scope);
  const unknown = burns.filter(burn => {
    const hash = burn.txHash.toLowerCase();
    return (
      burn.destinationDomain === CCTP_DOMAIN.ethereum &&
      !settled.has(hash) &&
      !storesHash(stored, hash) &&
      !stored.some(card => mayBeUnresolved(card, network, burn))
    );
  });
  const read = async (burn: DiscoveredBurn) => {
    const hash = burn.txHash.toLowerCase();
    try {
      const found = await lookup(burn.txHash);
      if (found.status === 'refused') {
        // Its log was read, so a missing receipt is a lagging node: read it again next run.
        if (found.reason !== 'not-found') settled.add(hash);
        return undefined;
      }
      const progress = await adapter.checkProgress(found.bridge, now(), context);
      if (progress?.kind === 'arrived' || progress?.kind === 'failed') {
        settled.add(hash);
        return undefined;
      }
      return { hash, burn, bridge: found.bridge, progress };
    } catch {
      return undefined;
    }
  };
  const found = (await Promise.all(unknown.map(read)))
    .filter(reading => reading !== undefined)
    .sort((a, b) => Number(a.burn.blockNumber - b.burn.blockNumber));
  let added = 0;
  const linked = new Set<string>();
  for (const { hash, burn, bridge, progress } of found) {
    // Read again: the launch or another tab may have stored it during the reads.
    if (storesHash(store.getSnapshot(scope), hash)) continue;
    store.upsert(scope, progress ? applyProgress(bridge, progress, now()) : bridge);
    added += 1;
    // The oldest stopped swap of this USDC and recipient, sent before the burn, is the one it spent.
    const swap = swaps
      .getSnapshot(scope)
      .filter(
        entry =>
          entry.network === network &&
          !entry.burn &&
          !entry.convert &&
          !linked.has(entry.swapTxHash) &&
          entry.usdcAmount === burn.amount &&
          addressToBytes32(entry.recipient as Hex) === burn.mintRecipient.toLowerCase() &&
          entry.at <= bridge.startedAt + CLOCK_SKEW_MS
      )
      .sort((a, b) => a.at - b.at)
      .at(0);
    if (swap) {
      linked.add(swap.swapTxHash);
      swaps.markBurn(scope, swap.swapTxHash, hash);
    }
  }
  return added;
}
