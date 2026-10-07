import type { TxCallbacks } from '@/modules/ui/context/transactionContract';

/**
 * Wraps the modal's callbacks to tell when the source bridge tx is known.
 * `onSent` gets the hash as soon as the bridge leg is broadcast, so a bridge
 * survives a closed tab or a failed receipt wait. A Safe returns its Safe tx
 * hash at the bridge leg's start instead (`onQueued`), and `onExecuted` later
 * gets the on-chain hash with that Safe tx hash. The bridge leg is any leg
 * whose `onMutate` function name isn't `approve`, so a skipped approve or a
 * Retry that resumes at the bridge leg is still recorded at broadcast.
 */
export function withSourceRecording(
  getCallbacks: () => TxCallbacks,
  {
    isSafe,
    onSent,
    onQueued,
    onExecuted
  }: {
    isSafe: boolean;
    onSent: (txHash: string) => void;
    onQueued: (safeTxHash: string) => void;
    onExecuted: (txHash: string, safeTxHash: string | undefined) => void;
  }
): TxCallbacks {
  let isApproveLeg = false;
  let recorded: string | undefined;
  return {
    onMutate: variables => {
      isApproveLeg = variables?.functionName === 'approve';
      getCallbacks().onMutate(variables);
    },
    onStart: hash => {
      if (hash && !isApproveLeg && !recorded) {
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
    // Not recorded here: the sequential flow can pass the previous leg's hash, and a batch its call id.
    onError: (error, hash) => getCallbacks().onError(error, hash)
  };
}
