import type { Call, TransactionReceipt } from 'viem';
import { useSequentialTransactionFlow } from '@/hooks/shared/useSequentialTransactionFlow';
import { TransactionRefusedError } from '@/hooks/shared/useTransactionOutcome';
import type { TxCallbacks } from '@/modules/ui/context/transactionContract';
import { usePromptIssuers } from './usePromptIssuers';

export const SEND_OUT_MESSAGE =
  'A transaction from your last bridge is still open in your wallet or pending. Wait for it to settle before sending again.';

/**
 * The engine of a card's single-leg action (a prove, finalize, replay, redeem or
 * keepalive). Each prompt's hash, failure and success reach the Confirm that
 * opened it, and a Confirm is refused while an earlier run's write is out:
 * the engine would send that run's held call under it.
 */
export function useActionLegFlow({
  calls,
  chainId,
  getCallbacks,
  onReceipt
}: {
  calls: Call[];
  chainId: number | undefined;
  getCallbacks: () => TxCallbacks;
  onReceipt?: (receipt: TransactionReceipt) => void;
}) {
  const { onMutate, issuerOf, lastIssuer } = usePromptIssuers(getCallbacks);
  const flow = useSequentialTransactionFlow({
    calls,
    enabled: calls.length > 0,
    chainId,
    failOnReplaced: true,
    onMutate,
    onStart: (hash, variables) => issuerOf(variables).onStart(hash),
    onReceipt,
    onSuccess: (hash, blockNumber) => lastIssuer().onSuccess(hash, blockNumber),
    onError: (error, hash, variables) => issuerOf(variables).onError(error, hash)
  });
  return {
    ...flow,
    execute: () =>
      flow.detached
        ? getCallbacks().onError(new TransactionRefusedError(SEND_OUT_MESSAGE), '')
        : flow.execute()
  };
}
