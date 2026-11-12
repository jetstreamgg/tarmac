import { t } from '@lingui/core/macro';
import { revertMessage } from '@/lib/revertMessages';

/**
 * Copy for an engine prepare/simulation failure, for flows without a
 * flow-specific mapper (those keep their own — stusds/pendle/stake simulation).
 * A contract revert reads as its reason (the revert registry's copy, or the
 * raw reason); anything else gets the generic retry line.
 *
 * Nothing renders while `prepared` is true: a recovered engine drops the
 * message with the next render, and post-submission failures (which leave
 * `prepared` true) stay owned by the transaction screen. Hosts that outlive a
 * transaction (the stake takeovers, convert) additionally pass `null` while
 * their form is idle, so a stale execution error can't masquerade as a prepare
 * failure once the engine is disabled.
 */
export function enginePrepareErrorMessage(
  prepared: boolean,
  error: Error | null | undefined
): string | undefined {
  if (prepared || !error) return undefined;
  return revertMessage(error) ?? t`Something went wrong preparing the transaction. Please try again.`;
}
