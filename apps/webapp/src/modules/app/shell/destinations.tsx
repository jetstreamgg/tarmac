import { ComponentType, MouseEvent, ReactNode, useCallback } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Trans } from '@lingui/react/macro';
import { Convert, Earn, StakeSky, Wallet } from '@/modules/icons';
import { Intent } from '@/lib/enums';
import { intentToPath, ROUTES, RoutePath } from '@/lib/routes';
import { AppRoutePath, retainOnNavigate, useRouteIntent } from '@/lib/navigation';
import { setPendingNavIntent } from '@/modules/analytics/lib/navigationIntent';

/**
 * The 4-destination IA shared by the desktop TopNav and the mobile Navbar
 * (M2). Both navs must agree on what the destinations are, which one is
 * active, and how mainnet-only links carry their network override — so all of
 * that lives here and the navs only differ in markup.
 */

// Destination paths must be in the route map AND mounted as routes (B1 placeholders guarantee it).
type DestinationPath = Extract<AppRoutePath, RoutePath>;

export type Destination = {
  path: DestinationPath;
  label: ReactNode;
  icon: ComponentType<{ className?: string }>;
  // Modules the destination covers; the first is its landing module and
  // decides the network override for the link.
  intents: Intent[];
};

// The 4 target-IA destinations (plan §4.2). Paths come from ROUTES, never hardcoded.
export const DESTINATIONS: Destination[] = [
  {
    path: ROUTES.PORTFOLIO,
    label: <Trans>Portfolio</Trans>,
    icon: Wallet,
    intents: [Intent.BALANCES_INTENT]
  },
  {
    path: ROUTES.EARN,
    label: <Trans>Earn</Trans>,
    icon: Earn,
    intents: [
      Intent.SAVINGS_INTENT,
      Intent.REWARDS_INTENT,
      Intent.VAULTS_INTENT,
      Intent.FIXED_INTENT,
      Intent.EXPERT_INTENT
    ]
  },
  { path: ROUTES.STAKE, label: <Trans>Stake SKY</Trans>, icon: StakeSky, intents: [Intent.STAKE_INTENT] },
  {
    path: ROUTES.CONVERT,
    label: <Trans>Convert</Trans>,
    icon: Convert,
    intents: [Intent.CONVERT_INTENT, Intent.TRADE_INTENT, Intent.UPGRADE_INTENT]
  }
];

export const navTestId = (path: RoutePath) => `nav-${path.slice(1)}`;

const isUnderDestination = (path: string, base: RoutePath) => path === base || path.startsWith(`${base}/`);

// Active destination: the current path when it sits under a destination, else
// the destination owning the route's intent (covers Balances at / → Portfolio).
export function useActiveDestinationPath(): RoutePath | null {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const routeIntent = useRouteIntent();
  const byPath = DESTINATIONS.find(d => isUnderDestination(pathname, d.path));
  if (byPath) return byPath.path;
  const intentPath = intentToPath(routeIntent);
  return DESTINATIONS.find(d => isUnderDestination(intentPath, d.path))?.path ?? null;
}

/**
 * Link plumbing shared by both navs: the search updater that carries the
 * network override in the href, and the click handler that flags the
 * auto-switch feedback and records the nav-analytics intent. Each nav passes
 * its own selection_method ('header_nav' desktop, 'mobile_drawer' bottom bar).
 */
export function useDestinationLinkProps(selectionMethod: 'header_nav' | 'mobile_drawer') {
  // A mainnet-only destination used to carry its network switch in the href
  // itself, so cmd-clicking one from an L2 opened a tab already pointed at
  // mainnet. With `network=` retired there is nothing chain-shaped to put in a
  // link — the tab arrives and the route guard switches on landing, same end
  // state a beat later — which is why this no longer varies by destination.
  const navSearch = retainOnNavigate;

  // Modified clicks open a new tab; this tab doesn't navigate, so skip the
  // switching feedback and the nav intent.
  const handleNavClick = useCallback(
    (targetPath: RoutePath) => (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      setPendingNavIntent(selectionMethod, targetPath);
      // The switching feedback used to be raised here, optimistically, because
      // the href already knew the destination's chain. The route guard decides
      // that now — and it may well decide not to switch (the visit has already
      // had its chance, or the chain is right) — so raising the flags on a
      // click would leave them set with nothing to clear them: only
      // `useNetworkChangeToast` does, and only on a real chain change.
    },
    [selectionMethod]
  );

  return { navSearch, handleNavClick };
}
