import { createContext, useContext } from 'react';

/**
 * True while the app-wide access gate (the Wallet blocked / Access blocked
 * dialog, see AccessGate) is on screen.
 *
 * Why anything needs to know: Radix puts the most recently opened modal in
 * charge of focus and clicks and switches the older ones off. If a page modal
 * opened after the gate (Back/Forward into a URL-driven flow such as Position
 * details), the gate would still be drawn on top but its buttons would stop
 * responding (APP-601).
 *
 * So while the gate is up, every Dialog and Sheet below it is forced closed,
 * and reopens by itself when the gate lifts. Closing unmounts their content,
 * so state kept inside the content resets; state in the parent (the URL, the
 * transaction provider) survives. TakeoverShell isn't a Radix layer, so it
 * stays mounted and goes inert instead.
 */
export const AccessGateUpContext = createContext(false);

export const useIsAccessGateUp = () => useContext(AccessGateUpContext);

/**
 * A Dialog or Sheet root's `open` prop, forced to false while the access gate
 * is up. Uncontrolled roots (no `open` prop) are left alone: they open from a
 * trigger, which the gate already covers.
 */
export const useClosedWhileAccessGateUp = (open: boolean | undefined) => {
  const gateUp = useIsAccessGateUp();
  return gateUp && open !== undefined ? false : open;
};
