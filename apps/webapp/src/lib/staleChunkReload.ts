import type { AnyRouter } from '@tanstack/react-router';

/**
 * A tab left open across a deploy still holds the old build's hashed chunk
 * URLs. Production answers an unknown asset path with index.html, so the
 * dynamic import rejects and Vite dispatches `vite:preloadError`. A full page
 * load fetches the current index.html with the live chunk hashes.
 *
 * Hovering a link preloads its chunks, so the failure alone must not move the
 * page: it marks the tab stale, and the full load happens on a navigation to
 * another page. Search-param updates (network, tabs, flows) stay in place. The
 * full load is allowed once per window so a real outage cannot loop.
 *
 * The event is deliberately not prevented: a prevented event makes Vite
 * resolve the failed import to `undefined` instead of rejecting, which would
 * bypass the router's own module-not-found recovery, the catch in
 * getDateLocale, and Sentry's chunk-load filters.
 */

const STORAGE_KEY = 'staleChunkReloadedAt';
const RELOAD_WINDOW_MS = 60_000;

const claimFullLoad = (): boolean => {
  try {
    const reloadedAt = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    const now = Date.now();
    if (Math.abs(now - reloadedAt) < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(STORAGE_KEY, String(now));
    return true;
  } catch {
    return false;
  }
};

export function installStaleChunkReload(router: AnyRouter): () => void {
  let isStale = false;

  const loadDocument = (href: string) => {
    // replace, not assign: the router has already pushed this entry (or is about to, in a microtask).
    if (claimFullLoad()) window.location.replace(href);
  };

  const onPreloadError = () => {
    isStale = true;
    const destination = router.latestLocation;
    // Read off the locations, not `status`: the router only turns pending after its preflight.
    if (destination.pathname !== router.state.resolvedLocation?.pathname) {
      loadDocument(destination.publicHref);
    }
  };

  window.addEventListener('vite:preloadError', onPreloadError);
  const unsubscribe = router.subscribe('onBeforeNavigate', ({ toLocation, pathChanged }) => {
    if (isStale && pathChanged) loadDocument(toLocation.publicHref);
  });

  return () => {
    window.removeEventListener('vite:preloadError', onPreloadError);
    unsubscribe();
  };
}
