import { Link, useParams, useRouter, useRouterState } from '@tanstack/react-router';
// Type-only: erased at runtime, so this does not pull the page graph into the
// navigation helpers (see modules/sentry/init.ts for why that matters).
import type { FileRouteTypes } from '@/routeTree.gen';
import { ComponentProps, useCallback, useMemo } from 'react';
import { ConvertIntent, FixedIntent, Intent, VaultsIntent } from '@/lib/enums';
import { IS_PRODUCTION_ENV, QueryParams } from '@/lib/constants';
import { GEO_OVERRIDE_PARAMS } from '@/modules/geo-config/applyGeoOverrides';
import { earnProductFilter } from '@/lib/routes';

// Routes declare which module (Intent) and submodule they render via staticData,
// so components can derive navigation state from the matched route instead of
// query params.
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    intent?: Intent;
    convertIntent?: ConvertIntent;
    vaultsIntent?: VaultsIntent;
    fixedIntent?: FixedIntent;
  }
}

/** A path registered in the app's route tree — typos or stale paths fail to compile. */
export type AppRoutePath = FileRouteTypes['to'];

/**
 * Path each module lives at. TRADE and UPGRADE have no destination of their
 * own — CoW trading is parked pending E3 and upgrade is the More-menu modal
 * (APP-413) — so both intents land on the Convert page.
 */
export const INTENT_PATHS: Record<Intent, AppRoutePath> = {
  [Intent.BALANCES_INTENT]: '/',
  [Intent.SAVINGS_INTENT]: '/earn/savings',
  [Intent.REWARDS_INTENT]: '/earn/rewards',
  [Intent.STAKE_INTENT]: '/stake',
  [Intent.CONVERT_INTENT]: '/convert',
  [Intent.EXPERT_INTENT]: '/earn/stusds',
  [Intent.VAULTS_INTENT]: '/earn/vaults',
  [Intent.FIXED_INTENT]: '/earn/fixed',
  [Intent.TRADE_INTENT]: '/convert',
  [Intent.UPGRADE_INTENT]: '/convert'
};

const useDeepestStaticData = <K extends keyof import('@tanstack/react-router').StaticDataRouteOption>(
  key: K
) =>
  useRouterState({
    select: s => {
      for (let i = s.matches.length - 1; i >= 0; i--) {
        const value = s.matches[i].staticData?.[key];
        if (value !== undefined) return value;
      }
      return undefined;
    }
  });

/** Module rendered by the current route. Defaults to Balances. */
export function useRouteIntent(): Intent {
  return (useDeepestStaticData('intent') as Intent | undefined) ?? Intent.BALANCES_INTENT;
}

export function useRouteConvertIntent(): ConvertIntent | undefined {
  return useDeepestStaticData('convertIntent') as ConvertIntent | undefined;
}

export function useRouteVaultsIntent(): VaultsIntent | undefined {
  return useDeepestStaticData('vaultsIntent') as VaultsIntent | undefined;
}

export function useRouteFixedIntent(): FixedIntent | undefined {
  return useDeepestStaticData('fixedIntent') as FixedIntent | undefined;
}

export type RouteEntityParams = {
  rewardContract?: string;
  provider?: string;
  vaultAddress?: string;
  marketAddress?: string;
  slug?: string;
};

/** Entity path params of the current route (reward contract, vault, market). */
export function useRouteEntityParams(): RouteEntityParams {
  return useParams({ strict: false }) as RouteEntityParams;
}

/**
 * Identity search reducer for navigations that keep the current search params.
 * Narrows away `undefined` values so it satisfies the router's strict search
 * output type (our parseSearch only ever produces strings).
 */
export const keepSearch = (prev: Record<string, string | undefined>): Record<string, string> => {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(prev)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
};

/**
 * `keepSearch` plus the Earn table's product filter for `intent` — the search
 * reducer for every fallback that lands on the marketplace instead of a
 * product page (a bare /earn/vaults, an unknown vault address, a retired
 * overview). Filtering to the family the user asked for beats dropping them on
 * the unfiltered table (APP-542); an intent with its own page is left alone.
 */
export const keepSearchFilteredTo =
  (intent: Intent) =>
  (prev: Record<string, string | undefined>): Record<string, string> => {
    const product = earnProductFilter(intent);
    const next = keepSearch(prev);
    return product ? { ...next, [QueryParams.Product]: product } : next;
  };

/**
 * Search params preserved when navigating between modules. Mirrors the legacy
 * deleteSearchParams behavior: keep network (and valid geo overrides in
 * non-production), drop module-specific state like flow or source_token.
 */
export function retainOnNavigate(prev: Record<string, string | undefined>): Record<string, string> {
  const retained: Record<string, string> = {};
  for (const key of [QueryParams.Network] as string[]) {
    if (prev[key] !== undefined) retained[key] = prev[key];
  }
  if (!IS_PRODUCTION_ENV) {
    for (const key of GEO_OVERRIDE_PARAMS) {
      if (prev[key] !== undefined) retained[key] = prev[key];
    }
  }
  return retained;
}

// Compatibility layer over TanStack Router that preserves the react-router-dom
// call-site shapes (`useSearchParams` tuple, href-string links/navigation) for
// the search params that remain query-driven (network, details, flow, tokens).

const splitHref = (href: string) => {
  const url = new URL(href, 'http://internal');
  return {
    pathname: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash ? url.hash.slice(1) : undefined
  };
};

export type SetSearchParams = (
  init: URLSearchParams | ((prev: URLSearchParams) => URLSearchParams),
  opts?: {
    replace?: boolean;
    /** Pass false to keep the scroll position instead of the router's reset to top. */
    resetScroll?: boolean;
  }
) => void;

/**
 * Key-sorted serialization of a search string or param record, so two sets can
 * be compared for equivalence without key order counting as a difference.
 */
const sortedSearchString = (input: string | Record<string, string>): string => {
  const params = new URLSearchParams(input);
  params.sort();
  return params.toString();
};

export function useAppSearchParams(): [URLSearchParams, SetSearchParams] {
  const router = useRouter();
  const searchStr = useRouterState({ select: s => s.location.searchStr });
  const searchParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);

  const setSearchParams = useCallback<SetSearchParams>(
    (init, opts) => {
      const currentSearchStr = router.state.location.searchStr;
      const next = typeof init === 'function' ? init(new URLSearchParams(currentSearchStr)) : init;
      const search = Object.fromEntries(next);

      // Bail when the result is the search string the URL already carries.
      // TanStack skips only the *history write* for such a navigation, not the
      // work: it still runs a full `load()`, which fires its own view
      // transition. When that lands mid-navigation the browser skips the
      // in-flight one, and a skipped transition applies its DOM update
      // immediately — the new page flashes in before the second transition
      // animates it. useAppOrchestration re-validates search params on every
      // intent change and arrives here with nothing to change, so this fired
      // on every module route (stake, convert, the product pages) but not
      // between two routes sharing an intent (portfolio <-> earn).
      if (sortedSearchString(search) === sortedSearchString(currentSearchStr)) return;

      void router.navigate({
        // Stay on the current path; passing a search object replaces the whole
        // search string, matching react-router's setSearchParams semantics.
        to: router.state.location.pathname as '/',
        search,
        replace: opts?.replace,
        resetScroll: opts?.resetScroll
      });
    },
    [router]
  );

  return [searchParams, setSearchParams];
}

export function useAppNavigate() {
  const router = useRouter();
  return useCallback(
    (to: string, opts?: { replace?: boolean }) => {
      const { pathname, search, hash } = splitHref(to);
      void router.navigate({ to: pathname as '/', search, hash, replace: opts?.replace });
    },
    [router]
  );
}

export type AppLinkProps = Omit<ComponentProps<'a'>, 'href'> & {
  to: string;
  replace?: boolean;
};

export function AppLink({ to, replace, ...anchorProps }: AppLinkProps) {
  const { pathname, search, hash } = splitHref(to);
  return (
    <Link
      {...anchorProps}
      to={pathname as '/'}
      // Merged onto the retained params rather than replacing the search
      // outright: an href without a query string means "this path", not "drop
      // the network". Dropping it made useAppOrchestration navigate straight
      // back to put it in, and that second commit landed in the same frame as
      // the view transition's pending snapshot — so the outgoing page was
      // captured already showing the incoming one, and only the enter
      // animation was visible (APP-432 review).
      search={prev => ({ ...retainOnNavigate(prev), ...search })}
      hash={hash}
      replace={replace}
    />
  );
}
