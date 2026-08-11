import { createContext } from 'react';

/**
 * Epoch bumped by the transaction modal each time the user backs out of the
 * wallet/status screen to the editable entry. Sequential engines subscribe and
 * drop their paused run on a bump (see useSequentialTransactionFlow), so the
 * next confirm freezes the calls the form currently shows (APP-448).
 *
 * Provided around the modal's `backgroundContent` host only, so a bump reaches
 * exactly the engine of the session whose Back was clicked — never a minimized
 * flow running elsewhere. The default means "no modal above us": engines
 * mounted outside the host never see a bump.
 */
export const BackToEditContext = createContext(0);
