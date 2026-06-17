import { WaitForTransactionReceiptErrorType, WaitForCallsStatusErrorType } from 'viem';

export function isRevertedError(
  failureReason: WaitForTransactionReceiptErrorType | WaitForCallsStatusErrorType | null
): boolean {
  if (
    failureReason?.toString().toLowerCase().includes('revert') ||
    failureReason?.toString().toLowerCase().includes('execution')
  ) {
    return true;
  }
  return false;
}

// EIP-1193 "user rejected request". Wallets nest this at varying depths in the
// viem cause chain (and don't always set err.name), so we walk the chain.
const USER_REJECTED_CODE = 4001;

/** True when an error is, or wraps, the user rejecting the request in their wallet. */
export function isUserRejection(error: unknown): boolean {
  let e: unknown = error;
  for (let i = 0; i < 10 && e; i++) {
    const code = (e as { code?: unknown })?.code;
    const name = (e as { name?: unknown })?.name;
    if (code === USER_REJECTED_CODE || name === 'UserRejectedRequestError') return true;
    const msg = String((e as { message?: unknown })?.message ?? '').toLowerCase();
    if (msg.includes('user rejected') || msg.includes('user denied')) return true;
    e = (e as { cause?: unknown })?.cause;
  }
  return false;
}

/** First numeric EIP-1193 / JSON-RPC code in the error cause chain, if any. */
export function extractErrorCode(error: unknown): number | undefined {
  let e: unknown = error;
  for (let i = 0; i < 10 && e; i++) {
    const code = (e as { code?: unknown })?.code;
    if (typeof code === 'number') return code;
    e = (e as { cause?: unknown })?.cause;
  }
  return undefined;
}

/** Ensure a value is an Error instance (wraps Viem/Wagmi error-like objects). */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'object' && value !== null && 'message' in value) {
    const source = value as Record<string, unknown>;
    const err = new Error(String(source.message));
    // Preserve all enumerable properties (code, cause, etc.) so downstream
    // consumers like shouldCaptureTransactionError can inspect nested metadata.
    Object.assign(err, source);
    if ('name' in source) err.name = String(source.name);
    return err;
  }
  return new Error(String(value));
}

export function formatBaLabsUrl(url: URL) {
  url.searchParams.append('format', 'json');

  return url;
}
