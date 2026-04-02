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
    const err = new Error(String((value as { message: unknown }).message));
    if ('code' in value) (err as any).code = (value as { code: unknown }).code;
    if ('name' in value) err.name = String((value as { name: unknown }).name);
    return err;
  }
  return new Error(String(value));
}

export function formatBaLabsUrl(url: URL) {
  url.searchParams.append('format', 'json');

  return url;
}