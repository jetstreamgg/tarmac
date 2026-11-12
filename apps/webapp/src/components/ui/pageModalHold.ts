import { createContext, useContext } from 'react';

/**
 * True while an app-level gate (the Wallet blocked / Access blocked dialog) is
 * up. Radix puts the most recently opened modal in charge of focus and clicks,
 * so a page modal opening after the gate (Back/Forward into a URL-driven flow)
 * would otherwise leave the gate visible but unclickable.
 *
 * Dialogs and sheets under the gate stay closed until it lifts, then reopen.
 * Closing unmounts their content, so state kept inside the content resets;
 * state in the parent (the URL, the transaction provider) survives.
 *
 * Only controlled roots (an `open` prop) are held. An uncontrolled one opens
 * from its trigger, which the gate already covers. TakeoverShell, which isn't a
 * Radix layer, goes inert instead.
 */
export const PageModalHoldContext = createContext(false);

export const usePageModalHold = () => useContext(PageModalHoldContext);

/** A dialog or sheet root's `open` prop with the hold applied. */
export const useHeldOpen = (open: boolean | undefined) => {
  const held = usePageModalHold();
  return held && open !== undefined ? false : open;
};
