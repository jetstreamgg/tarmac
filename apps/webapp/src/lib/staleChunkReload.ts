/**
 * A tab left open across a deploy still holds the old build's hashed chunk
 * URLs. Cloudflare Pages answers a missing chunk path with index.html, so the
 * dynamic import rejects and Vite dispatches `vite:preloadError`. Reloading
 * fetches the current index.html with the live chunk hashes. The reload is
 * allowed once per window so a real outage cannot loop.
 */

const STORAGE_KEY = 'staleChunkReloadedAt';
const RELOAD_WINDOW_MS = 60_000;

type Deps = {
  reload?: () => void;
  now?: () => number;
};

const readReloadedAt = (): number | null => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored === null ? 0 : Number(stored);
  } catch {
    return null;
  }
};

const writeReloadedAt = (timestamp: number): boolean => {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(timestamp));
    return true;
  } catch {
    return false;
  }
};

export function installStaleChunkReload({
  reload = () => window.location.reload(),
  now = Date.now
}: Deps = {}): () => void {
  const onPreloadError = (event: Event) => {
    event.preventDefault();
    const reloadedAt = readReloadedAt();
    if (reloadedAt === null || now() - reloadedAt < RELOAD_WINDOW_MS) return;
    if (!writeReloadedAt(now())) return;
    reload();
  };
  window.addEventListener('vite:preloadError', onPreloadError);
  return () => window.removeEventListener('vite:preloadError', onPreloadError);
}
