import { sanitizeUrl } from '@/lib/utils';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export interface TermsCheckResult {
  termsAccepted: boolean;
  error: false;
  accessDenied?: boolean;
}

export interface TermsCheckError {
  termsAccepted: false;
  error: true;
  lastError?: unknown;
}

export type TermsCheckOutcome = TermsCheckResult | TermsCheckError;

export async function checkTermsWithRetry(address: string): Promise<TermsCheckOutcome> {
  const url = sanitizeUrl(`${import.meta.env.VITE_TERMS_ENDPOINT}/check`);
  if (!url) {
    return {
      termsAccepted: false,
      error: true,
      lastError: new Error('Invalid or missing VITE_TERMS_ENDPOINT')
    };
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
        return { termsAccepted: res.termsAccepted, error: false };
      }

      // 403 is a deliberate access denial (VPN/restricted region or sanctioned address) — not an error
      if (response.status === 403) {
        return { termsAccepted: false, error: false, accessDenied: true };
      }

      // Other 4xx are deterministic client errors — don't retry
      if (response.status >= 400 && response.status < 500) {
        return {
          termsAccepted: false,
          error: true,
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

  return { termsAccepted: false, error: true, lastError };
}
