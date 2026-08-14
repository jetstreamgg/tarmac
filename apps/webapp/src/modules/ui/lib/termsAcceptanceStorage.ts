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

/**
 * Mirrors the flags for this page's lifetime, under the same keys.
 *
 * Some browsers throw on *any* `localStorage` access — Safari with "Block all
 * cookies", locked-down enterprise profiles, some webviews. Without this copy
 * the gate's local half could never materialise for them: acceptance would
 * write its DB row, the flag write would fail silently, the gate would stay
 * shut, and the modal would reopen forever while every attempt appended
 * another `terms_acceptance_events` row.
 *
 * Because the keys are identical the gate's semantics are unchanged — an
 * address switch or a version bump still re-prompts, and the AND with the DB
 * half is untouched. This copy does not survive a reload, so these users
 * re-accept on their next page load: the same fail-closed direction the design
 * already takes for a second device or cleared site data.
 */
const sessionFlags = new Set<string>();

export function hasLocalTermsAcceptance(address: string, version: string): boolean {
  const key = termsAcceptanceKey(address, version);

  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    // Storage blocked, so the session copy is the only record there is. Note
    // this is reached on a *throw*, not on a miss: when storage works and
    // simply has no flag, the answer is genuinely no. That keeps the session
    // copy from outvoting a user who cleared their site data mid-session.
    return sessionFlags.has(key);
  }
}

export function recordLocalTermsAcceptance(address: string, version: string): void {
  const key = termsAcceptanceKey(address, version);
  const prefix = keyPrefixForAddress(address);

  // A version bump strands this address's previous flag, so drop it rather
  // than leaving one dead key behind per bump. Both copies are pruned the same
  // way, so neither can answer for a version the other has forgotten.
  for (const stale of sessionFlags) {
    if (stale.startsWith(prefix)) sessionFlags.delete(stale);
  }

  try {
    for (const stored of Object.keys(localStorage)) {
      if (stored.startsWith(prefix)) localStorage.removeItem(stored);
    }
    localStorage.setItem(key, 'true');
  } catch {
    // Storage blocked, private mode or quota: hold the flag in memory for this
    // page's lifetime so the gate can open at all. Written only on failure, so
    // a browser with working storage keeps exactly one source of truth.
    sessionFlags.add(key);
  }
}
