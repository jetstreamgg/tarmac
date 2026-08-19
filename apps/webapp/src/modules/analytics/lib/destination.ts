import type { CaptureResult } from 'posthog-js';

/**
 * The app section an event was captured in, stamped on every PostHog event via
 * `before_send` (APP-444 D2). Derived from the URL at capture time — no
 * register/unregister churn. `upgrade` is the one URL-less surface: while its
 * modal is open it overrides the underlying section.
 */
export type Destination = 'portfolio' | 'earn' | 'stake' | 'convert' | 'upgrade';

const SECTION_BY_PREFIX: ReadonlyArray<readonly [string, Destination]> = [
  ['/portfolio', 'portfolio'],
  ['/earn', 'earn'],
  ['/stake', 'stake'],
  ['/convert', 'convert']
];

// Module-level because before_send runs outside React. Set by the upgrade
// modal's open/close (wired with the upgrade instrumentation).
let upgradeModalOpen = false;

export function setUpgradeModalOpen(open: boolean): void {
  upgradeModalOpen = open;
}

/** Section for a pathname, or undefined off-section (root redirect, /seal-engine, dev pages). */
export function destinationFromPathname(pathname: string): Destination | undefined {
  return SECTION_BY_PREFIX.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];
}

/**
 * `before_send` hook: stamps `destination` on every event. Kept in the
 * composable array form so later hooks (e.g. the URL sanitizer) chain after it.
 */
export function stampDestination(event: CaptureResult | null): CaptureResult | null {
  if (!event) return event;
  const destination = upgradeModalOpen ? 'upgrade' : destinationFromPathname(window.location.pathname);
  if (destination) {
    event.properties = { ...event.properties, destination };
  }
  return event;
}
