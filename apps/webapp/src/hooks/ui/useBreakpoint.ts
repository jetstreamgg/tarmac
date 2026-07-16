import { useCallback, useSyncExternalStore } from 'react';

/**
 * The single JS breakpoint system. See docs/responsive-breakpoints.md for the
 * tier strategy and when to reach for JS instead of Tailwind variants.
 *
 * Everything here is matchMedia-based via useSyncExternalStore: values are
 * correct on the first render (no `false` flash) and update only when the
 * media query flips, not on every resize frame.
 */

/**
 * Track an arbitrary CSS media query.
 *
 * @param query - CSS media query string (e.g., '(max-height: 900px)')
 * @returns whether the query currently matches
 *
 * @example
 * const isShortViewport = useMediaQuery('(max-height: 900px)');
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener('change', onStoreChange);
      return () => mediaQuery.removeEventListener('change', onStoreChange);
    },
    [query]
  );

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

// Mirrors the Tailwind breakpoints in globals.css (@theme --breakpoint-*).
// `desktop` (1200) is the M/L tier of the design-system grid; the other values
// are the legacy scale kept for pre-redesign screens.
export enum BP {
  sm = 0,
  md = 1,
  lg = 2,
  desktop = 3,
  xl = 4,
  '2xl' = 5
}

// Min-width threshold that upgrades into each tier above `sm`. Note there is
// no 640 threshold: the JS scale has always lumped 0–767 into `sm`.
const BP_MIN_WIDTHS = [768, 912, 1200, 1280, 1400];

const BP_QUERIES = BP_MIN_WIDTHS.map(width => `(min-width: ${width}px)`);

const subscribeToBreakpoints = (onStoreChange: () => void) => {
  const mediaQueries = BP_QUERIES.map(query => window.matchMedia(query));
  mediaQueries.forEach(mediaQuery => mediaQuery.addEventListener('change', onStoreChange));
  return () => {
    mediaQueries.forEach(mediaQuery => mediaQuery.removeEventListener('change', onStoreChange));
  };
};

const getBreakpointIndex = (): BP =>
  BP_QUERIES.filter(query => window.matchMedia(query).matches).length as BP;

/**
 * Current breakpoint tier as an ordinal, for layout decisions that can't be
 * expressed as Tailwind variants (portals, chart geometry, remount keys).
 *
 * @example
 * const { bpi } = useBreakpointIndex();
 * const isMobile = bpi < BP.md;
 */
export const useBreakpointIndex = (): { bpi: BP } => {
  const bpi = useSyncExternalStore(subscribeToBreakpoints, getBreakpointIndex);
  return { bpi };
};
