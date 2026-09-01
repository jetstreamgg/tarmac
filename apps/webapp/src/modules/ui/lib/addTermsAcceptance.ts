import { sanitizeUrl } from '@/lib/utils';

export type TermsAddOutcome = { ok: true } | { ok: false; status?: number; lastError?: unknown };

/**
 * Phase A (APP-498): records that the terms were presented to, and accepted
 * for, `address` at the current version. No wallet signature — that is Phase
 * B, which posts to `/terms-acceptance/sign` (C6). Posting a signature here
 * answers `400`, so the body carries the address and nothing else; a stray
 * `chainId` would be ignored rather than guessed at.
 *
 * Repeat acceptances are the normal path rather than an error. A returning
 * user on a new browser, a second device, or after clearing site data is
 * shown the terms again, and each acceptance inserts another
 * `terms_acceptance_events` row — a distinct "presented at this IP at this
 * time" record. Every one of them answers `201`.
 */
export async function addTermsAcceptance(address: string): Promise<TermsAddOutcome> {
  const url = sanitizeUrl(`${import.meta.env.VITE_TERMS_ENDPOINT}/add`);
  if (!url) {
    return { ok: false, lastError: new Error('Invalid or missing VITE_TERMS_ENDPOINT') };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address })
    });

    if (response.ok) return { ok: true };

    return {
      ok: false,
      status: response.status,
      lastError: new Error(`Terms acceptance failed with status ${response.status}`)
    };
  } catch (error) {
    return { ok: false, lastError: error };
  }
}
