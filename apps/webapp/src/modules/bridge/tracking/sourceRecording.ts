import { TransactionReplacedError, TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';

/**
 * Wraps the modal's callbacks to tell when the source bridge tx is known.
 * `onSent` gets the hash as soon as the bridge leg is broadcast, so a bridge
 * survives a closed tab or a failed receipt wait. A Safe returns its Safe tx
 * hash at the bridge leg's start instead (`onQueued`), and `onExecuted` later
 * gets the on-chain hash with that Safe tx hash. The bridge leg is the leg
 * whose `onMutate` function name is `bridgeFunctionName` (or a leg with no
 * name), so other legs such as an approve or a swap are never recorded, and a
 * skipped approve or a Retry that resumes at the bridge leg still records it.
 * `onFailed` gets the sent hash when it reverted or was cancelled or replaced;
 * a Safe's execution is read by its tracker instead. A send sped up in the
 * wallet starts again under a new hash, passed to `onRepriced`. A wallet
 * bundle has no hash when accepted: `onBundled` records it under the id it
 * returns, `onBundleMined` gets that id and the hash the bundle reported once
 * it mines, and a failed bundle is passed to `onFailed` with that id.
 */
export function withSourceRecording(
  getCallbacks: () => TxCallbacks,
  {
    isSafe,
    bridgeFunctionName,
    onSent,
    onQueued,
    onExecuted,
    onFailed,
    onRepriced,
    onBundled,
    onBundleMined
  }: {
    isSafe: boolean;
    /** The function name of the call that moves the funds, e.g. `depositForBurn`. */
    bridgeFunctionName: string;
    onSent: (txHash: string) => void;
    onQueued: (safeTxHash: string) => void;
    onExecuted: (txHash: string, safeTxHash: string | undefined) => void;
    onFailed: (txHash: string, reason: string) => void;
    onRepriced: (txHash: string, newTxHash: string) => void;
    /** Records an accepted wallet bundle and returns its card id. */
    onBundled?: () => string;
    onBundleMined?: (bundleId: string, hash: string | undefined) => void;
  }
): TxCallbacks {
  let isBridgeLeg = true;
  let recorded: string | undefined;
  let bundled = false;
  // The hash the recorded send will mine under.
  let current: string | undefined;
  return {
    onMutate: variables => {
      const functionName = variables?.functionName;
      isBridgeLeg = functionName === undefined || functionName === bridgeFunctionName;
      getCallbacks().onMutate(variables);
    },
    onStart: hash => {
      if (hash && isBridgeLeg && !recorded) {
        recorded = current = hash;
        if (isSafe) onQueued(hash);
        else onSent(hash);
      } else if (!hash && isBridgeLeg && !isSafe && !recorded && onBundled) {
        recorded = onBundled();
        bundled = true;
      } else if (hash && isBridgeLeg && !isSafe && recorded && hash !== current) {
        current = hash;
        onRepriced(recorded, hash);
      }
      getCallbacks().onStart(hash);
    },
    onSuccess: (hash, blockNumber) => {
      // A bundle's success hash can be another call's, e.g. the approve.
      if (bundled && recorded) onBundleMined?.(recorded, hash);
      else if (hash && isSafe) onExecuted(hash, recorded);
      else if (hash && !recorded) onSent(hash);
      getCallbacks().onSuccess(hash, blockNumber);
    },
    // Recorded only for the sent hash: the sequential flow can pass the previous leg's hash, and a batch its call id.
    onError: (error, hash) => {
      if (bundled && recorded) {
        if (isBundleFailure(error)) onFailed(recorded, 'source-tx-reverted');
      } else if (!isSafe && recorded && (hash === recorded || hash === current)) {
        if (error instanceof TransactionReplacedError) onFailed(recorded, 'source-tx-replaced');
        else if (error instanceof TransactionRevertedError) onFailed(recorded, 'source-tx-reverted');
      }
      getCallbacks().onError(error, hash);
    }
  };
}

/** The batch engine's error for a bundle that settled as failed, or a reverted receipt. */
export function isBundleFailure(error: unknown): boolean {
  return (
    (error instanceof Error && error.message === BATCH_FAILED_MESSAGE) ||
    error instanceof TransactionRevertedError
  );
}

const BATCH_FAILED_MESSAGE = 'ERROR: Batch transaction failed';
