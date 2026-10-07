/**
 * A tab left open across a deploy still holds the old build's hashed chunk
 * URLs. Production answers an unknown asset path with index.html, so the
 * dynamic import rejects and Vite dispatches `vite:preloadError`. Reloading
 * fetches the current index.html with the live chunk hashes. The reload is
 * allowed once per window so a real outage cannot loop.
 *
 * The event is deliberately not prevented: a prevented event makes Vite
 * resolve the failed import to `undefined` instead of rejecting, which would
 * bypass the router's own module-not-found recovery, the catch in
 * getDateLocale, and Sentry's chunk-load filters.
 */

const STORAGE_KEY = 'staleChunkReloadedAt';
const RELOAD_WINDOW_MS = 60_000;

export function installStaleChunkReload(): void {
  window.addEventListener('vite:preloadError', () => {
    try {
      const reloadedAt = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
      const now = Date.now();
      if (Math.abs(now - reloadedAt) < RELOAD_WINDOW_MS) return;
      sessionStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      return;
    }
    window.location.reload();
  });
}
