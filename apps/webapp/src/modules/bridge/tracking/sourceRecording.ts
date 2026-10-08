import type { WaitForTransactionReceiptErrorType } from 'viem';
import { isRevertedError, TransactionReplacedError } from '@/hooks/helpers';
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
 * wallet starts again under a new hash, passed to `onRepriced`.
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
    onRepriced
  }: {
    isSafe: boolean;
    /** The function name of the call that moves the funds, e.g. `depositForBurn`. */
    bridgeFunctionName: string;
    onSent: (txHash: string) => void;
    onQueued: (safeTxHash: string) => void;
    onExecuted: (txHash: string, safeTxHash: string | undefined) => void;
    onFailed: (txHash: string, reason: string) => void;
    onRepriced: (txHash: string, newTxHash: string) => void;
  }
): TxCallbacks {
  let isBridgeLeg = true;
  let recorded: string | undefined;
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
      } else if (hash && isBridgeLeg && !isSafe && recorded && hash !== current) {
        current = hash;
        onRepriced(recorded, hash);
      }
      getCallbacks().onStart(hash);
    },
    onSuccess: (hash, blockNumber) => {
      if (hash && isSafe) onExecuted(hash, recorded);
      else if (hash && !recorded) onSent(hash);
      getCallbacks().onSuccess(hash, blockNumber);
    },
    // Recorded only for the sent hash: the sequential flow can pass the previous leg's hash, and a batch its call id.
    onError: (error, hash) => {
      if (!isSafe && recorded && (hash === recorded || hash === current)) {
        if (error instanceof TransactionReplacedError) onFailed(recorded, 'source-tx-replaced');
        else if (isRevertedError(error as WaitForTransactionReceiptErrorType))
          onFailed(recorded, 'source-tx-reverted');
      }
      getCallbacks().onError(error, hash);
    }
  };
}
