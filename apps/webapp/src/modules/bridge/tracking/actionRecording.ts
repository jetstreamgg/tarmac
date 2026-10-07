import type { WaitForTransactionReceiptErrorType } from 'viem';
import { isRevertedError, TransactionReplacedError } from '@/hooks/helpers';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';

/**
 * Wraps the modal's callbacks to record a destination action: `onSent` at
 * broadcast, `onConfirmed` once mined (a Safe passes its on-chain hash here),
 * and `onReverted` only when the sent hash reverted or was cancelled or replaced.
 * Any other failure keeps it sent, since the transaction may still land.
 */
export function withActionRecording(
  getCallbacks: () => TxCallbacks,
  {
    onSent,
    onConfirmed,
    onReverted
  }: {
    onSent: (txHash: string) => void;
    onConfirmed: (txHash: string) => void;
    onReverted: (txHash: string) => void;
  }
): TxCallbacks {
  let sent: string | undefined;
  return {
    onMutate: variables => getCallbacks().onMutate(variables),
    onStart: hash => {
      if (hash && !sent) {
        sent = hash;
        onSent(hash);
      }
      getCallbacks().onStart(hash);
    },
    onSuccess: hash => {
      if (hash) onConfirmed(hash);
      getCallbacks().onSuccess(hash);
    },
    onError: (error, hash) => {
      const neverLands =
        error instanceof TransactionReplacedError ||
        isRevertedError(error as WaitForTransactionReceiptErrorType);
      if (sent && hash === sent && neverLands) {
        onReverted(hash);
      }
      getCallbacks().onError(error, hash);
    }
  };
}
