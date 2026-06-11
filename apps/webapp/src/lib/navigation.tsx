import { Link, useParams, useRouter, useRouterState } from '@tanstack/react-router';
// Type-only: erased at runtime, so this does not pull the page graph into the
// navigation helpers (see modules/sentry/init.ts for why that matters).
import type { FileRouteTypes } from '@/routeTree.gen';
import { ComponentProps, useCallback, useMemo } from 'react';
import { ConvertIntent, ExpertIntent, FixedIntent, Intent, VaultsIntent } from '@/lib/enums';
import { IS_PRODUCTION_ENV, QueryParams } from '@/lib/constants';
import { GEO_OVERRIDE_PARAMS } from '@/modules/geo-config/applyGeoOverrides';

// Routes declare which module (Intent) and submodule they render via staticData,
// so components can derive navigation state from the matched route instead of
// query params.
declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    intent?: Intent;
    convertIntent?: ConvertIntent;
    expertIntent?: ExpertIntent;
    vaultsIntent?: VaultsIntent;
    fixedIntent?: FixedIntent;
  }
}

/** A path registered in the app's route tree — typos or stale paths fail to compile. */
export type AppRoutePath = FileRouteTypes['to'];

/** Path each module lives at. TRADE/UPGRADE intents render as Convert submodules. */
export const INTENT_PATHS: Record<Intent, AppRoutePath> = {
  [Intent.BALANCES_INTENT]: '/',
  [Intent.SAVINGS_INTENT]: '/savings',
  [Intent.REWARDS_INTENT]: '/rewards',
  [Intent.STAKE_INTENT]: '/stake',
  [Intent.CONVERT_INTENT]: '/convert',
  [Intent.EXPERT_INTENT]: '/expert',
  [Intent.VAULTS_INTENT]: '/vaults',
  [Intent.FIXED_INTENT]: '/fixed',
  [Intent.TRADE_INTENT]: '/convert/trade',
  [Intent.UPGRADE_INTENT]: '/convert/upgrade'
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

export function useRouteExpertIntent(): ExpertIntent | undefined {
  return useDeepestStaticData('expertIntent') as ExpertIntent | undefined;
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
  opts?: { replace?: boolean }
) => void;

export function useAppSearchParams(): [URLSearchParams, SetSearchParams] {
  const router = useRouter();
  const searchStr = useRouterState({ select: s => s.location.searchStr });
  const searchParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);

  const setSearchParams = useCallback<SetSearchParams>(
    (init, opts) => {
      const next =
        typeof init === 'function' ? init(new URLSearchParams(router.state.location.searchStr)) : init;
      void router.navigate({
        // Stay on the current path; passing a search object replaces the whole
        // search string, matching react-router's setSearchParams semantics.
        to: router.state.location.pathname as '/',
        search: Object.fromEntries(next),
        replace: opts?.replace
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
  return <Link {...anchorProps} to={pathname as '/'} search={search} hash={hash} replace={replace} />;
}
