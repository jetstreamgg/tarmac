import type { TxCallbacks } from '@/modules/ui/context/transactionContract';

/**
 * Wraps the modal's callbacks to tell when the source bridge tx is known.
 * A Safe returns its Safe tx hash at the last leg's start (`onQueued`), so the
 * bridge is stored before the signers act; `onExecuted` gets the on-chain hash
 * with the Safe tx hash queued earlier, if any. `legs` is how many starts the
 * flow reports (1 for a batch).
 */
export function withSourceRecording(
  getCallbacks: () => TxCallbacks,
  {
    legs,
    isSafe,
    onQueued,
    onExecuted
  }: {
    legs: number;
    isSafe: boolean;
    onQueued: (safeTxHash: string) => void;
    onExecuted: (txHash: string, safeTxHash: string | undefined) => void;
  }
): TxCallbacks {
  let starts = 0;
  let queued: string | undefined;
  return {
    onMutate: variables => getCallbacks().onMutate(variables),
    onStart: hash => {
      starts += 1;
      if (isSafe && hash && starts === legs) {
        queued = hash;
        onQueued(hash);
      }
      getCallbacks().onStart(hash);
    },
    onSuccess: hash => {
      if (hash) onExecuted(hash, queued);
      getCallbacks().onSuccess(hash);
    },
    onError: (error, hash) => getCallbacks().onError(error, hash)
  };
}
