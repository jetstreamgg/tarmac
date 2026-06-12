import { createContext, useContext, CSSProperties } from 'react';

/**
 * Classes of the widget pane content block inside the pane column.
 * Shared between the shell chrome (AppShell) and the per-route TwoPane
 * content so the pane keeps its size/scroll behavior.
 */
export const paneContentClasses = 'pl-4 pt-2 pr-1.5 pb-4 md:pl-1.5 md:pr-0 md:pb-1 lg:py-1 lg:pr-0';

type ShellChromeContextValue = {
  /** Height style for the widget pane content block (mobile sizing). */
  paneStyle: CSSProperties | undefined;
  /** Portal target for the md+ details pane, sibling of the widget pane column. */
  detailsSlot: HTMLElement | null;
};

export const ShellChromeContext = createContext<ShellChromeContextValue>({
  paneStyle: undefined,
  detailsSlot: null
});

export const useShellChrome = () => useContext(ShellChromeContext);
