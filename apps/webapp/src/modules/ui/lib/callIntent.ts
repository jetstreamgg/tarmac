import type { Call, Hex } from 'viem';
import { getCallData } from '@/hooks/shared/networkFee';

/** A call reduced to what the wallet signs: target, calldata, value. */
export type EncodedCall = { to: string; data: Hex; value: bigint };

/**
 * Encode calls to the bytes the wallet would sign, so two call lists compare
 * on everything at once (amounts, min-outs, receivers, routes) with no field
 * list to keep in sync. Null when a call cannot be encoded, which callers
 * treat as a mismatch.
 */
export function encodeCalls(calls: readonly Call[]): EncodedCall[] | null {
  try {
    return calls.map(call => ({
      to: call.to.toLowerCase(),
      data: getCallData(call),
      value: call.value ?? 0n
    }));
  } catch {
    return null;
  }
}

/**
 * Whether `live` is the tail of `confirmed`: every call still to be sent is one
 * the user confirmed, in the confirmed order. Calls may drop off the front (an
 * approve that landed, a sequence resuming past a mined step), never change.
 * An empty `live` against a non-empty `confirmed` fails: the flow can no longer
 * build what was confirmed (an expired quote), and dispatching it would send
 * nothing while the modal waits on the wallet.
 */
export function isTailOf(live: readonly EncodedCall[], confirmed: readonly EncodedCall[]): boolean {
  if (live.length === 0) return confirmed.length === 0;
  const offset = confirmed.length - live.length;
  if (offset < 0) return false;
  return live.every((call, i) => {
    const expected = confirmed[offset + i];
    return call.to === expected.to && call.data === expected.data && call.value === expected.value;
  });
}
