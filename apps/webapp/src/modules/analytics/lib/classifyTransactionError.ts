import { isUserRejection, extractErrorCode } from '@/hooks/helpers';

export type WidgetErrorKind = 'user_rejected' | 'reverted' | 'wallet_error' | 'unknown';

/**
 * Classifies a widget tx failure into bounded, address-free properties for
 * analytics. `hasTxHash` splits on-chain reverts (a tx was broadcast) from
 * pre-submission failures (wallet rejections, gas/funds, chain mismatch). Only
 * the enum, the numeric code, and the viem class name are captured — never the
 * raw message, which can embed wallet addresses and calldata.
 */
export function classifyTransactionError(error: unknown, hasTxHash: boolean): Record<string, unknown> {
  // A rejection happens before broadcast, so it never carries a tx_hash. If one
  // exists the tx reached the chain and can't be a rejection — this also stops a
  // revert reason that happens to contain "user rejected"/"user denied" from
  // being miscounted as a cancel.
  const is_user_rejection = !hasTxHash && isUserRejection(error);
  const error_code = extractErrorCode(error);
  // Top-level viem class (e.g. ContractFunctionExecutionError), kept stable for
  // grouping rather than the deepest cause.
  const name = (error as { name?: unknown } | null)?.name;
  const error_name = typeof name === 'string' ? name : undefined;

  const error_kind: WidgetErrorKind = is_user_rejection
    ? 'user_rejected'
    : hasTxHash
      ? 'reverted'
      : error != null
        ? 'wallet_error'
        : 'unknown';

  return {
    error_kind,
    is_user_rejection,
    ...(error_code !== undefined && { error_code }),
    ...(error_name !== undefined && { error_name })
  };
}
