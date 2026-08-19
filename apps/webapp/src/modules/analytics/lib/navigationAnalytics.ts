import { pathToIntent, isEarnMarketplacePath } from '@/lib/routes';
import { WIDGET_NAME_BY_INTENT } from '../contract';
import type { SelectionMethod } from '../constants';
import { consumePendingNavIntent } from './navigationIntent';

/**
 * Pure core of the central navigation subscription (APP-444 fase 2). The hook
 * (useNavigationAnalytics) wires this to router.history.subscribe; keeping the
 * handler a plain closure makes it testable without a router instance.
 *
 * Emission rule (D5 two-level taxonomy): product routes emit
 * app_widget_selected; containers (/portfolio, /earn) and off-map routes never
 * do — they are covered by $pageview + the destination super-prop.
 */

/** widget_name for a product pathname, null for containers/off-map routes. */
export function pathnameToWidgetName(pathname: string): string | null {
  const intent = pathToIntent(pathname);
  return intent ? (WIDGET_NAME_BY_INTENT[intent] ?? null) : null;
}

/** previous_widget vocabulary: products, 'earn_marketplace', else 'balances'. */
export function pathnameToPreviousWidget(pathname: string): string {
  if (isEarnMarketplacePath(pathname)) return 'earn_marketplace';
  const intent = pathToIntent(pathname);
  return (intent && WIDGET_NAME_BY_INTENT[intent]) || 'balances';
}

export type NavigationSubscriberDeps = {
  startNewFlow: () => void;
  trackWidgetSelected: (args: {
    widgetName: string;
    previousWidget: string;
    selectionMethod: SelectionMethod;
    chainId: number;
  }) => void;
  getChainId: () => number;
};

type HistorySubscriberArgs = {
  location: { pathname: string };
  action: { type: 'PUSH' | 'REPLACE' | 'FORWARD' | 'BACK' | 'GO' };
};

export function createNavigationSubscriber(initialPathname: string, deps: NavigationSubscriberDeps) {
  let previousPathname = initialPathname;

  return ({ location, action }: HistorySubscriberArgs): void => {
    const fromPathname = previousPathname;
    // Tracked for every action so previous_widget stays right after replaces
    // (redirects, param rewrites) and back/forward traversals.
    previousPathname = location.pathname;
    // Always consumed, so a click that lands on a non-emitting route can't
    // leak its selection_method into a later navigation.
    const pending = consumePendingNavIntent();

    // Replaces are app-issued redirects/param writes; traversals revisit an
    // already-counted selection. Only user-driven pushes to a new path count.
    if (action.type !== 'PUSH' || location.pathname === fromPathname) return;

    // New destination = new funnel, rotated before emitting so the selection
    // event carries the flow it opens (dev parity).
    deps.startNewFlow();

    const widgetName = pathnameToWidgetName(location.pathname);
    if (!widgetName) return;

    deps.trackWidgetSelected({
      widgetName,
      previousWidget: pathnameToPreviousWidget(fromPathname),
      selectionMethod: pending?.pathname === location.pathname ? pending.method : 'link',
      chainId: deps.getChainId()
    });
  };
}
