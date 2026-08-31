import { createContext } from 'react';

/**
 * True beneath a rendered `Layout`. Chrome-owning fallbacks (the router's
 * ErrorPage) read this to decide whether to supply their own Layout or render
 * bare under the one already on screen: a route-level error surfaces inside the
 * shell's Layout, while a root-level one replaces the whole tree, chrome included.
 */
export const InsideLayoutContext = createContext(false);
