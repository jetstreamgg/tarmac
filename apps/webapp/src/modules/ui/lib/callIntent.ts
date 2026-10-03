import type { Call, Hex } from 'viem';
import { getCallData } from '@/hooks/shared/networkFee';

/**
 * A call reduced to what the wallet signs: target, calldata, value. `call` keeps
 * the call it was encoded from, for a flow's own `CallMatcher`.
 */
export type EncodedCall = { to: string; data: Hex; value: bigint; call: Call };

/**
 * Whether a live call may stand in for the confirmed one at the same position.
 * The default is byte equality; see `tightensOnly` for the one relaxation.
 */
export type CallMatcher = (live: Call, confirmed: Call) => boolean;

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
      value: call.value ?? 0n,
      call
    }));
  } catch {
    return null;
  }
}

const sameBytes = (a: EncodedCall, b: EncodedCall) =>
  a.to === b.to && a.data === b.data && a.value === b.value;

/** Byte equality on the raw calls; a call that cannot be encoded matches nothing. */
export const exactMatch: CallMatcher = (live, confirmed) => {
  const encoded = encodeCalls([live, confirmed]);
  return !!encoded && sameBytes(encoded[0], encoded[1]);
};

/**
 * A matcher for calls whose only post-confirm drift is a slippage bound the
 * contract enforces (a min-out or max-in that follows a live quote). A listed
 * call matches when everything but that argument is byte-equal and the bound
 * moved only in the user's favour: a min-out up, a max-in down. A tighter bound
 * can at worst revert; a looser one, or any other change, is refused. Calls not
 * listed by function name fall back to `exactMatch`.
 */
export function tightensOnly(bounds: Record<string, { index: number; kind: 'min' | 'max' }>): CallMatcher {
  return (live, confirmed) => {
    const bound = 'functionName' in live ? bounds[live.functionName as string] : undefined;
    if (
      !bound ||
      !('functionName' in confirmed) ||
      confirmed.functionName !== live.functionName ||
      !Array.isArray(live.args) ||
      !Array.isArray(confirmed.args)
    ) {
      return exactMatch(live, confirmed);
    }
    const liveBound = live.args[bound.index];
    const confirmedBound = confirmed.args[bound.index];
    if (typeof liveBound !== 'bigint' || typeof confirmedBound !== 'bigint') return false;
    const withoutBound = (call: Call, args: readonly unknown[]) =>
      ({ ...call, args: args.map((arg, i) => (i === bound.index ? 0n : arg)) }) as Call;
    if (!exactMatch(withoutBound(live, live.args), withoutBound(confirmed, confirmed.args))) return false;
    return bound.kind === 'min' ? liveBound >= confirmedBound : liveBound <= confirmedBound;
  };
}

/**
 * Whether `live` is the tail of `confirmed`: every call still to be sent is one
 * the user confirmed, in the confirmed order. Calls may drop off the front (an
 * approve that landed, a sequence resuming past a mined step), never change
 * beyond what `matches` allows (a flow's `callMatches`; byte equality otherwise).
 * An empty `live` against a non-empty `confirmed` fails: the flow can no longer
 * build what was confirmed (an expired quote), and dispatching it would send
 * nothing while the modal waits on the wallet.
 */
export function isTailOf(
  live: readonly EncodedCall[],
  confirmed: readonly EncodedCall[],
  matches?: CallMatcher
): boolean {
  if (live.length === 0) return confirmed.length === 0;
  const offset = confirmed.length - live.length;
  if (offset < 0) return false;
  return live.every((call, i) => {
    const expected = confirmed[offset + i];
    return matches ? matches(call.call, expected.call) : sameBytes(call, expected);
  });
}
