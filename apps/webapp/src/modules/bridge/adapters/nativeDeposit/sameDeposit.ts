import { isAddress, type Address } from 'viem';
import type { BridgeProgress } from '../../model/pendingTransitions';
import type { PendingBridge } from '../../model/types';

/** What a deposit mints on the L2: how much USDS, and to whom. */
export type DepositMint = { amount: bigint; recipient: Address };

/** The mint a card's deposit asked for; undefined when its recipient isn't an address. */
export function depositMint(bridge: Pick<PendingBridge, 'amount' | 'account' | 'recipient'>) {
  const recipient = bridge.recipient ?? bridge.account;
  return isAddress(recipient) ? ({ amount: bridge.amount, recipient } satisfies DepositMint) : undefined;
}

/**
 * One progress for the deposits of a transaction a card can't tell apart (same
 * amount, same recipient): an action any of them needs comes first, arrived
 * only once all arrived, and anything unread or mixed is null: nothing changes.
 */
export function progressOfAll(results: (BridgeProgress | null)[]): BridgeProgress | null {
  if (results.length === 1) return results[0];
  if (results.length === 0 || results.some(result => result === null)) return null;
  const known = results as BridgeProgress[];
  const ready = known.find(result => result.kind === 'ready');
  if (ready) return ready;
  if (known.some(result => result.kind === 'waiting')) return { kind: 'waiting' };
  return known.every(result => result.kind === known[0].kind) ? known[0] : null;
}
