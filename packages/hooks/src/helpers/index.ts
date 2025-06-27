import { WaitForTransactionReceiptErrorType } from 'viem';

export function isRevertedError(failureReason: WaitForTransactionReceiptErrorType | null): boolean {
  if (
    failureReason?.toString().toLowerCase().includes('revert') ||
    failureReason?.toString().toLowerCase().includes('execution')
  ) {
    return true;
  }
  return false;
}

export function formatBaLabsUrl(url: URL) {
  url.searchParams.append('format', 'json');

  return url;
}
