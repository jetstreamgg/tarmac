type WalletErrorCandidate = { code?: number | string; name?: string; cause?: unknown };

/**
 * EIP-1193 4100: the wallet hasn't allowed this site the account, network or
 * method (stale permission, locked wallet, expired session). Nothing was sent.
 * Walks the cause chain, where viem nests the provider's error.
 */
export function isUnauthorizedRequestError(error: unknown): boolean {
  let candidate = error as WalletErrorCandidate | undefined;
  for (let depth = 0; candidate && typeof candidate === 'object' && depth < 8; depth += 1) {
    if (String(candidate.code) === '4100' || candidate.name === 'UnauthorizedProviderError') return true;
    candidate = candidate.cause as WalletErrorCandidate | undefined;
  }
  return false;
}
