/**
 * The browser half of the terms gate (APP-499).
 *
 * Browsing is gated on this flag AND the DB's `accepted` boolean — either one
 * missing re-prompts. The DB alone cannot tell "this person saw the modal"
 * from "someone did": `POST /terms-acceptance/add` is unauthenticated, so
 * anyone can seed a row for any address. The local flag is what records that
 * *this browser* was shown the terms for *this address*, which is the fact
 * that matters if an acceptance is ever disputed (Kacper, 10 Aug 2026).
 *
 * Keyed by address AND version, never version alone: accept with wallet A in
 * this browser, then switch to wallet B whose row already exists from another
 * device, and a version-only key would read as present for B too — B's owner
 * would never be shown the terms here.
 */

const STORAGE_PREFIX = 'sky.termsAccepted';

/**
 * Addresses are lower-cased: the DB stores them that way (a trigger), so a
 * checksummed and a lower-case spelling of one address must share a flag.
 */
const keyPrefixForAddress = (address: string) => `${STORAGE_PREFIX}:${address.toLowerCase()}:`;

export const termsAcceptanceKey = (address: string, version: string) =>
  `${keyPrefixForAddress(address)}${version}`;

export function hasLocalTermsAcceptance(address: string, version: string): boolean {
  try {
    return localStorage.getItem(termsAcceptanceKey(address, version)) === 'true';
  } catch {
    // Storage unavailable (private mode). No flag means the modal is shown
    // again, which is the fail-closed direction.
    return false;
  }
}

export function recordLocalTermsAcceptance(address: string, version: string): void {
  try {
    // A version bump strands this address's previous flag, so drop it rather
    // than leaving one dead key behind per bump.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(keyPrefixForAddress(address))) localStorage.removeItem(key);
    }
    localStorage.setItem(termsAcceptanceKey(address, version), 'true');
  } catch {
    // ignore storage write failures (private mode, quota)
  }
}
