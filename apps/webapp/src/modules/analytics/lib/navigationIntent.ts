import type { SelectionMethod } from '../constants';

/**
 * Hand-off between click handlers and the central navigation subscription
 * (useNavigationAnalytics): a handler records how the user asked for a
 * navigation just before triggering it, and the history subscriber consumes it
 * when the navigation lands. Module-level (not React state) because the
 * subscriber runs outside the component tree.
 */

export type PendingNavIntent = {
  method: SelectionMethod;
  /** The pathname the click targets; the subscriber only honors a match. */
  pathname: string;
};

let pending: PendingNavIntent | null = null;

export function setPendingNavIntent(method: SelectionMethod, pathname: string): void {
  pending = { method, pathname };
}

/** Read-and-clear: every history event consumes the intent, matching or not. */
export function consumePendingNavIntent(): PendingNavIntent | null {
  const current = pending;
  pending = null;
  return current;
}
