import type { TxCallbacks } from '@/modules/ui/context/transactionContract';

/**
 * Wraps the modal's callbacks to tell when the source bridge tx is known.
 * `onSent` gets the hash as soon as the last leg is broadcast, so a bridge
 * survives a closed tab or a failed receipt wait. A Safe returns its Safe tx
 * hash at the last leg's start instead (`onQueued`), and `onExecuted` later
 * gets the on-chain hash with that Safe tx hash. `legs` is how many starts the
 * flow reports (1 for a batch).
 */
export function withSourceRecording(
  getCallbacks: () => TxCallbacks,
  {
    legs,
    isSafe,
    onSent,
    onQueued,
    onExecuted
  }: {
    legs: number;
    isSafe: boolean;
    onSent: (txHash: string) => void;
    onQueued: (safeTxHash: string) => void;
    onExecuted: (txHash: string, safeTxHash: string | undefined) => void;
  }
): TxCallbacks {
  let starts = 0;
  let recorded: string | undefined;
  return {
    onMutate: variables => getCallbacks().onMutate(variables),
    onStart: hash => {
      starts += 1;
      if (hash && starts === legs) {
        recorded = hash;
        if (isSafe) onQueued(hash);
        else onSent(hash);
      }
      getCallbacks().onStart(hash);
    },
    onSuccess: hash => {
      if (hash && isSafe) onExecuted(hash, recorded);
      else if (hash && !recorded) onSent(hash);
      getCallbacks().onSuccess(hash);
    },
    onError: (error, hash) => getCallbacks().onError(error, hash)
  };
}
