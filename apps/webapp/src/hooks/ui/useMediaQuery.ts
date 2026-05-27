import { useCallback, useSyncExternalStore } from 'react';

/**
 * Custom hook to track media query matches
 * @param query - CSS media query string (e.g., '(max-width: 768px)')
 * @returns boolean indicating if the media query matches
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 768px)');
 * const isSmallHeight = useMediaQuery('(max-height: 900px)');
 */
export function useMediaQuery(query: string): boolean {
  // Subscribe via React's sanctioned external-store API — avoids
  // setState-in-effect by letting React read the value directly.
  const subscribe = useCallback(
    (notify: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener('change', notify);
      return () => mediaQuery.removeEventListener('change', notify);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
