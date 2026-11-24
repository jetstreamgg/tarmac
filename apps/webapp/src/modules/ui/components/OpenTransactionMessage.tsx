import { Trans } from '@lingui/react/macro';
import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { TxStatus } from '@/modules/ui/lib/txStatus';

/** Why a form or card waits on an open transaction: still running, or failed and waiting on the user. */
export function OpenTransactionMessage() {
  const { txStatus } = useTransaction();
  return txStatus === TxStatus.ERROR ? (
    <Trans>A transaction failed. Open it to try again or close it.</Trans>
  ) : (
    <Trans>A transaction is in progress. Open it to continue.</Trans>
  );
}
