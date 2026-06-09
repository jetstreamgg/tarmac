import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { ComponentProps, useCallback, useMemo } from 'react';

// Compatibility layer over TanStack Router that preserves the react-router-dom
// call-site shapes (`useSearchParams` tuple, href-string links/navigation) while
// navigation is still query-param driven. Phase 2 of the path-navigation
// migration replaces these with typed routes, params and search.

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
