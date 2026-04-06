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