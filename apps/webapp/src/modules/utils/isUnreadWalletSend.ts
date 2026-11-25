type Caused = { name?: unknown; cause?: unknown };

/**
 * A send the wallet answered with an error viem couldn't classify, such as a
 * connector's own time limit: the wallet may have sent it anyway. Read by name,
 * down the cause chain, so a second copy of viem in the bundle can't hide it.
 */
export function isUnreadWalletSend(error: unknown): boolean {
  let candidate = error as Caused | undefined;
  for (let depth = 0; candidate && typeof candidate === 'object' && depth < 8; depth += 1) {
    if (candidate.name === 'TransactionExecutionError') {
      return (candidate.cause as Caused | undefined)?.name === 'UnknownRpcError';
    }
    candidate = candidate.cause as Caused | undefined;
  }
  return false;
}
