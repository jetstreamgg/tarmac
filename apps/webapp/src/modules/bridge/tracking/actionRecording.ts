import { TransactionReplacedError, TransactionRevertedError } from '@/hooks/shared/useTransactionOutcome';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';

/**
 * Wraps the modal's callbacks to record a destination action: `onSent` at
 * broadcast, `onConfirmed` once mined (a Safe passes its on-chain hash here,
 * a bundle every transaction it ran),
 * and `onReverted` only when the sent hash reverted or was cancelled or replaced.
 * Any other failure keeps it sent, since the transaction may still land. A
 * transaction sped up in the wallet starts again under a new hash; it still
 * reverts the action under the hash it was sent with. With
 * `actionFunctionName`, a leg known to call another function (an approve, a
 * sale after a claim) never records or reverts the action, and with
 * `confirmOnNextLeg` the action confirms once a later leg starts, since legs
 * go out only after the one before mined (not for a Safe, whose start hash is
 * its Safe tx hash); the run's last leg then confirms as part of it.
 */
export function withActionRecording(
  getCallbacks: () => TxCallbacks,
  {
    onSent,
    onConfirmed,
    onReverted,
    actionFunctionName,
    confirmOnNextLeg = false
  }: {
    onSent: (txHash: string) => void;
    onConfirmed: (txHash: string, bundleTxHashes?: string[]) => void;
    onReverted: (txHash: string) => void;
    actionFunctionName?: string;
    confirmOnNextLeg?: boolean;
  }
): TxCallbacks {
  let sent: string | undefined;
  let current: string | undefined;
  let confirmed = false;
  // The function of the leg last prompted; unknown counts as the action.
  let prompted: string | undefined;
  const isOtherLeg = (functionName?: string) =>
    !!actionFunctionName && !!functionName && functionName !== actionFunctionName;
  return {
    onMutate: variables => {
      prompted = variables?.functionName;
      if (confirmOnNextLeg && current && !confirmed && isOtherLeg(prompted)) {
        confirmed = true;
        onConfirmed(current);
      }
      getCallbacks().onMutate(variables);
    },
    onStart: hash => {
      if (isOtherLeg(prompted)) return getCallbacks().onStart(hash);
      if (hash && !sent) {
        sent = hash;
        onSent(hash);
      }
      if (hash) current = hash;
      getCallbacks().onStart(hash);
    },
    onSuccess: (...settled) => {
      const [hash, , bundleTxHashes] = settled;
      if (hash && confirmed && current && hash !== current && !bundleTxHashes) {
        // Confirmed early under its own leg: the run's last leg joins it, so its sale is read.
        onConfirmed(current, [current, hash]);
      } else if (hash) {
        confirmed = true;
        if (bundleTxHashes) onConfirmed(hash, bundleTxHashes);
        else onConfirmed(hash);
      }
      getCallbacks().onSuccess(...settled);
    },
    onError: (error, hash) => {
      const neverLands =
        error instanceof TransactionReplacedError || error instanceof TransactionRevertedError;
      if (sent && !confirmed && (hash === sent || hash === current) && neverLands) {
        onReverted(sent);
      }
      getCallbacks().onError(error, hash);
    }
  };
}
