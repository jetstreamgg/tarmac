type PrepareRevertListener = (error: unknown, chainId: number | undefined) => void;

let listener: PrepareRevertListener | undefined;

/**
 * Where the engines' prepare-time simulation failures go: the app registers
 * analytics' `trackPrepareReverted` at boot (pages/App.tsx). An indirection on
 * purpose — the engines sit behind the `@/hooks` barrel, which scripts and
 * Playwright helpers import without the Lingui macro transform, so they can't
 * reach the revert registry's copy (or PostHog) themselves.
 */
export function setPrepareRevertListener(next: PrepareRevertListener | undefined): void {
  listener = next;
}

/** A prepare simulation failed; the listener decides whether it was a revert worth tracking. */
export function reportPrepareRevert(error: unknown, chainId: number | undefined): void {
  if (error) listener?.(error, chainId);
}
