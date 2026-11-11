import type { BridgeProgress } from '../model/pendingTransitions';
import type { PendingBridgeAction } from '../model/types';
import type { CallsStatus } from './recoverDeposits';

/**
 * How a bundle the wallet reports ended: failed when it did or any of its
 * transactions reverted, ran with the hashes of its transactions, and null
 * while unknown.
 */
export function bundleOutcome(
  reported: CallsStatus | undefined
): { kind: 'failed' } | { kind: 'ran'; txHashes: [string, ...string[]] } | null {
  const receipts = reported?.receipts ?? [];
  if (reported?.status === 'failure' || receipts.some(receipt => receipt.status === 'reverted'))
    return { kind: 'failed' };
  if (reported?.status !== 'success' || receipts.length === 0) return null;
  const [first, ...rest] = receipts.map(receipt => receipt.transactionHash);
  return { kind: 'ran', txHashes: [first, ...rest] };
}

/**
 * What the wallet's status of a bundle says about the destination action sent
 * with it: confirmed under its first transaction, dropped by its calls id when
 * it failed or any transaction reverted, and null while unknown.
 */
export function bundleActionProgress(
  sent: PendingBridgeAction,
  reported: CallsStatus | undefined
): BridgeProgress | null {
  const outcome = bundleOutcome(reported);
  if (!outcome) return null;
  if (outcome.kind === 'failed') return { kind: 'action-dropped', txHash: sent.txHash };
  const [first, ...rest] = outcome.txHashes;
  return {
    kind: 'action-confirmed',
    action: sent.action,
    txHash: first,
    ...(rest.length > 0 && { bundleTxHashes: rest })
  };
}
