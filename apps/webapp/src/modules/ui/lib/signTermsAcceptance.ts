import { sanitizeUrl } from '@/lib/utils';

export type TermsSignOutcome = { ok: true } | { ok: false; status?: number; lastError?: unknown };

/**
 * Phase B (APP-501): attaches the wallet's off-chain signature to the current
 * terms version. The message that was signed is NOT part of the payload — the
 * worker holds the only copy of the text (served as `messageToSign` on
 * `/check`, APP-508) and verifies against that same constant, so a
 * `signedMessage` field in the body would simply be ignored.
 *
 * Both worker answers are success: `201` records the signature, `200` (with
 * `signatureAttached: false`) means this address already signed the current
 * version — an idempotent no-op, not an error. Either way the transaction may
 * proceed.
 */
export async function signTermsAcceptance(
  address: string,
  chainId: number,
  signature: string
): Promise<TermsSignOutcome> {
  const url = sanitizeUrl(`${import.meta.env.VITE_TERMS_ENDPOINT}/sign`);
  if (!url) {
    return { ok: false, lastError: new Error('Invalid or missing VITE_TERMS_ENDPOINT') };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ address, chainId, signature })
    });

    if (response.ok) return { ok: true };

    return {
      ok: false,
      status: response.status,
      lastError: new Error(`Terms signature submission failed with status ${response.status}`)
    };
  } catch (error) {
    return { ok: false, lastError: error };
  }
}
