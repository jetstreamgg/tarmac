import { createContext, useContext } from 'react';

/**
 * True while an app-level gate (the Wallet blocked / Access blocked dialog) is
 * up. Dialogs and sheets under it stay closed until it lifts, then come back
 * as they were: Radix puts the most recently opened modal in charge of focus
 * and clicks, so a page modal opening after the gate (Back/Forward into a
 * URL-driven flow) would otherwise leave the gate visible but unclickable.
 *
 * Only controlled roots (an `open` prop) are held. An uncontrolled one opens
 * from its trigger, which the gate already covers. TakeoverShell, which isn't a
 * Radix layer, goes inert instead.
 */
export const PageModalHoldContext = createContext(false);

export const usePageModalHold = () => useContext(PageModalHoldContext);
