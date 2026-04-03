import { sanitizeUrl } from '@/lib/utils';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export interface TermsCheckResult {
  termsAccepted: boolean;
  error: false;
}

export interface TermsCheckError {
  termsAccepted: false;
  error: true;
  lastError?: unknown;
}

export type TermsCheckOutcome = TermsCheckResult | TermsCheckError;

export async function checkTermsWithRetry(address: string): Promise<TermsCheckOutcome> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(sanitizeUrl(`${import.meta.env.VITE_TERMS_ENDPOINT}/check`) || '', {
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

      lastError = new Error(`Terms check failed with status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  return { termsAccepted: false, error: true, lastError };
}
