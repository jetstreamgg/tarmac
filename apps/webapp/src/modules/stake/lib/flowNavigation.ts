// Opening or closing a stake overlay only toggles search params, so it keeps the scroll instead of the router's reset to top.
export const FLOW_NAV_OPTIONS = { replace: true, resetScroll: false } as const;
