import { t } from '@lingui/core/macro';

/**
 * Generic copy for an engine prepare/simulation failure, for flows without a
 * flow-specific mapper (those keep their own — stusds/pendle/stake simulation).
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
  return t`Something went wrong preparing the transaction. Please try again.`;
}
