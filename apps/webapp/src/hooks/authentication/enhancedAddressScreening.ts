import type { AddressScreeningResult } from './useRestrictedAddressCheck';

/**
 * Enhanced address screening for high-value transactions (APP-517): at or
 * above the USD threshold the webapp screens the address against
 * `/address/status/enhanced` — a stricter provider configuration (co-vasp,
 * 3 hops) — INSTEAD of the standard `/address/status` check. The endpoint
 * shares the standard check's request/response contract; the threshold and
 * the transaction's USD valuation live entirely in the webapp.
 */

export const ENHANCED_SCREENING_THRESHOLD_USD = 250_000;

/**
 * Whether a transaction's USD value puts it on the enhanced-screening path.
 * An UNKNOWN value (no valuation source, price feed down, amounts not yet
 * resolved) counts as above-threshold: requiring a check we may not have owed
 * beats skipping one we did — the same fail-closed posture as the rest of the
 * compliance surface.
 */
export const requiresEnhancedScreening = (usdValue: number | undefined): boolean =>
  // NaN (a malformed price string) is as unknown as undefined — and `NaN >= x`
  // is false, which would otherwise fail OPEN.
  usdValue === undefined || Number.isNaN(usdValue) || usdValue >= ENHANCED_SCREENING_THRESHOLD_USD;

/**
 * Deliberately a DIFFERENT key from `addressScreeningQueryKey`: a cached
 * "clean" verdict from standard screening must never satisfy the enhanced
 * path (nor the reverse). The pre-transaction gate and the modal's preflight
 * share this key, so one verdict per address serves both.
 */
export const enhancedAddressScreeningQueryKey = (address?: string) => ['auth-enhanced', address];

// Unlike the standard fetcher's optional address (whose no-address call
// defaults to allowed), this one requires it: both callers already guard on a
// connected address, and a fail-open default has no place in a file whose
// every other path fails closed.
export const fetchEnhancedAddressScreening = async (
  address: string,
  authUrl?: string
): Promise<AddressScreeningResult> => {
  if (!authUrl) {
    throw new Error('Missing auth URL');
  }
  const res = await fetch(`${authUrl}/address/status/enhanced?address=${address}`);
  if (res.status !== 200) {
    // Fail closed: an unavailable enhanced check must block, never pass.
    throw new Error('non 200 response received');
  }
  const data = await res.json();
  return { addressAllowed: data.addressAllowed };
};
