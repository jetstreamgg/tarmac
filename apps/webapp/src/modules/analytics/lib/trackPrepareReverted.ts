import posthog from 'posthog-js';
import { decodeRevert, isInputRevert, hasRevertCopy, revertReasonForReporting } from '@/lib/revertMessages';
import { POSTHOG_ENABLED } from '../PostHogProvider';
import { AppEvents, getViewport, safeCapture } from '../constants';

/** Chain and reason pairs already captured this page load. */
const captured = new Set<string>();

/** Test seam: forget what was captured. */
export function resetPrepareRevertTracking(): void {
  captured.clear();
}

/**
 * app_transaction_prepare_reverted: a transaction the user was about to confirm
 * fails simulation with a contract revert, which the form shows instead of
 * the confirm (APP-663). Never reaches Sentry: a user hitting a protocol rule
 * isn't an app failure, and the webapp's alert rule would page on the common
 * ones.
 *
 * Simulation re-runs on every keystroke, so this captures each chain and
 * reason once per page load, and skips reasons the user's input caused (an
 * amount over their balance) altogether. Errors without a revert (a failed
 * request, a reasonless revert) aren't captured.
 */
export function trackPrepareReverted(error: unknown, chainId: number | undefined): void {
  if (!POSTHOG_ENABLED || !error) return;
  const revert = decodeRevert(error);
  if (!revert || isInputRevert(revert)) return;
  const reason = revertReasonForReporting(revert);
  const key = `${chainId}:${reason}`;
  if (captured.has(key)) return;
  captured.add(key);
  safeCapture(posthog, AppEvents.TRANSACTION_PREPARE_REVERTED, {
    revert_reason: reason,
    revert_kind: revert.kind,
    revert_has_copy: hasRevertCopy(revert),
    ...(chainId !== undefined && { chain_id: chainId }),
    viewport: getViewport()
  });
}
