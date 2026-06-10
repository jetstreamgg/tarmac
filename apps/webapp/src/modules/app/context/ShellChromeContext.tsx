import { createContext, useContext, CSSProperties } from 'react';

/**
 * Classes of the widget pane content block inside the navigation column.
 * Shared between the shell chrome (WidgetNavigation) and the per-route
 * TwoPane content so the pane keeps its size/scroll behavior.
 */
export const paneContentClasses = 'pl-4 pt-2 pr-1.5 pb-4 md:pl-1.5 md:pr-0 md:pb-1 lg:py-1 lg:pr-0';

type ShellChromeContextValue = {
  /** Height style for the widget pane content block (mobile/tablet sizing). */
  paneStyle: CSSProperties | undefined;
  /** Portal target for the md+ details pane, sibling of the navigation column. */
  detailsSlot: HTMLElement | null;
};

export const ShellChromeContext = createContext<ShellChromeContextValue>({
  paneStyle: undefined,
  detailsSlot: null
});

export const useShellChrome = () => useContext(ShellChromeContext);
