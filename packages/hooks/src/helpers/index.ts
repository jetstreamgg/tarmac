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

export function formatBaLabsUrl(url: URL) {
  url.searchParams.append('format', 'json');

  return url;
}

/**
 * Strips the `{chainId}-` prefix from an Envio entity ID to recover the original value.
 * e.g. "1-0xabc123..." → "0xabc123..."
 */
export function stripChainIdPrefix(id: string): string {
  const dashIndex = id.indexOf('-');
  return dashIndex !== -1 ? id.slice(dashIndex + 1) : id;
}
