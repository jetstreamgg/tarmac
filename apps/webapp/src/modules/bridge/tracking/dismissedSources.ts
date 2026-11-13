import { TransactionReceiptNotFoundError, type Hex } from 'viem';
import { isTransactionKnown } from '../adapters/sentAction';
import type { AdapterContext } from '../adapters/types';
import { isSourceUnseen } from '../model/pendingTransitions';
import type { PendingBridge } from '../model/types';
import type { createDismissedSourceStore, DismissedBridge } from '../store/dismissedSourceStore';
import type { PendingBridgeStore } from '../store/pendingStore';

type DismissedSourceStore = ReturnType<typeof createDismissedSourceStore>;

/** Dismisses a card; one dropped because its chain had no record of its send is kept to be looked for. */
export function dismissBridge({
  store,
  dismissed,
  scope,
  id
}: {
  store: PendingBridgeStore;
  dismissed: DismissedSourceStore;
  scope: string;
  id: string;
}) {
  const dropped = store.dismiss(scope, id);
  if (dropped && isSourceUnseen(dropped)) dismissed.add(scope, dropped);
}

const withoutUnseen = (bridge: PendingBridge): PendingBridge => {
  const next = { ...bridge };
  delete next.sourceUnseenAt;
  return next;
};

/**
 * Looks for a dismissed send on its chain: once the chain knows it, mined or
 * pending, the card comes back. A failed read, or a chain that still doesn't
 * know it, leaves it dismissed. Returns whether the card came back.
 */
export async function reviveDismissed({
  entry,
  scope,
  store,
  dismissed,
  context
}: {
  entry: DismissedBridge;
  scope: string;
  store: PendingBridgeStore;
  dismissed: DismissedSourceStore;
  context: AdapterContext;
}): Promise<boolean> {
  const { bridge } = entry;
  const source = context.getClient(bridge.from);
  if (!source || !bridge.txHash) return false;
  const hash = bridge.txHash as Hex;
  let known: boolean;
  try {
    await source.getTransactionReceipt({ hash });
    known = true;
  } catch (error) {
    if (!(error instanceof TransactionReceiptNotFoundError)) return false;
    try {
      known = await isTransactionKnown(source, hash);
    } catch {
      return false;
    }
  }
  if (!known) return false;
  store.upsert(scope, withoutUnseen(bridge));
  dismissed.remove(scope, bridge.id);
  return true;
}
