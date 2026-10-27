import { isUserRejection, extractErrorCode } from '@/hooks/helpers';
import { TransactionReplacedError } from '@/hooks/shared/useTransactionOutcome';
import { revertReport } from '@/lib/revertMessages';

export type WidgetErrorKind = 'user_rejected' | 'reverted' | 'wallet_error' | 'unknown';

export interface TransactionErrorProperties {
  error_kind: WidgetErrorKind;
  is_user_rejection: boolean;
  error_code?: number;
  error_name?: string;
  /** The contract's revert reason, addresses and long numbers blanked out (see revertReport). */
  revert_reason?: string;
  /** Whether the revert registry has copy for that reason, or the user saw it verbatim. */
  revert_has_copy?: boolean;
}

/**
 * Classifies a widget tx failure into bounded, address-free properties for
 * analytics. `hasTxHash` splits on-chain reverts (a tx was broadcast) from
 * pre-submission failures (wallet rejections, gas/funds, chain mismatch). Only
 * the enum, the numeric code, the viem class name and the contract's revert
 * reason (scrubbed) are captured — never the raw message, which can embed
 * wallet addresses and calldata.
 */
export function classifyTransactionError(error: unknown, hasTxHash: boolean): TransactionErrorProperties {
  // A rejection happens before broadcast, so it never carries a tx_hash. If one
  // exists the tx reached the chain and can't be a rejection — this also stops a
  // revert reason that happens to contain "user rejected"/"user denied" from
  // being miscounted as a cancel. The one exception is a transaction the user
  // replaced in their wallet after broadcast (cancel / same-nonce replacement),
  // which the receipt watcher reports as a TransactionReplacedError.
  const is_user_rejection =
    error instanceof TransactionReplacedError || (!hasTxHash && isUserRejection(error));
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

  const revert = is_user_rejection ? undefined : revertReport(error);

  return {
    error_kind,
    is_user_rejection,
    ...(error_code !== undefined && { error_code }),
    ...(error_name !== undefined && { error_name }),
    ...(revert && {
      revert_reason: revert.reason,
      revert_has_copy: revert.hasCopy
    })
  };
}
