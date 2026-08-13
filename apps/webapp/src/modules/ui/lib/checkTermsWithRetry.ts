import { sanitizeUrl } from '@/lib/utils';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/** What `POST /terms-acceptance/check` reports (APP-498, APP-508). */
export interface TermsCheckData {
  /**
   * A `terms_acceptance_events` row exists for (address, current version).
   * One half of the browse gate — the other is the localStorage flag.
   */
  accepted: boolean;
  /**
   * A `terms-acceptance` row exists for (address, current version); a row
   * there *is* a signature. Gates the per-transaction signature step (C6),
   * never browsing. Uncorrelated with `accepted`: all four combinations are
   * reachable, since a version bump between the two phases leaves a signature
   * for a version that was never accepted.
   */
  signedForCurrentVersion: boolean;
  /** The version both booleans were evaluated against, and the local flag's key component. */
  latestVersion: string;
  /**
   * The exact text Phase B must sign. The worker holds the only copy and
   * verifies against that same constant (APP-508), so this is passed to
   * `signMessage` unchanged and never stored. Optional because only C6 needs
   * it — its absence must not block browsing.
   */
  messageToSign?: string;
}

export type TermsCheckOutcome =
  | ({ status: 'ok' } & TermsCheckData)
  /** 403 — a deliberate refusal by region/VPN or address screening, not a failure. */
  | { status: 'access-denied' }
  | { status: 'error'; lastError?: unknown };

export async function checkTermsWithRetry(address: string): Promise<TermsCheckOutcome> {
  const url = sanitizeUrl(`${import.meta.env.VITE_TERMS_ENDPOINT}/check`);
  if (!url) {
    return { status: 'error', lastError: new Error('Invalid or missing VITE_TERMS_ENDPOINT') };
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ address })
      });

      if (response.ok) {
        const res = await response.json();

        // Without a version there is no key for the local flag, so the AND
        // gate could never be satisfied and the modal would reopen forever.
        // An explicit retry screen beats an unfixable loop.
        if (typeof res?.latestVersion !== 'string' || res.latestVersion === '') {
          return {
            status: 'error',
            lastError: new Error('Terms check response carried no latestVersion')
          };
        }

        return {
          status: 'ok',
          accepted: res.accepted === true,
          signedForCurrentVersion: res.signedForCurrentVersion === true,
          latestVersion: res.latestVersion,
          messageToSign: typeof res.messageToSign === 'string' ? res.messageToSign : undefined
        };
      }

      // 403 is a deliberate access denial (VPN/restricted region or sanctioned address) — not an error
      if (response.status === 403) {
        return { status: 'access-denied' };
      }

      // Other 4xx are deterministic client errors — don't retry
      if (response.status >= 400 && response.status < 500) {
        return {
          status: 'error',
          lastError: new Error(`Terms check failed with status ${response.status}`)
        };
      }

      // 5xx are server errors — worth retrying
      lastError = new Error(`Terms check failed with status ${response.status}`);
    } catch (error) {
      // Network errors — worth retrying
      lastError = error;
    }

    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  return { status: 'error', lastError };
}
