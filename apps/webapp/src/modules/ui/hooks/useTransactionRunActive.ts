import { useTransaction } from '@/modules/ui/context/TransactionContext';
import { TxStatus } from '@/modules/ui/lib/txStatus';

/**
 * Whether the open modal's run has started and not yet succeeded: confirmed
 * (INITIALIZED), sending or mining (LOADING), or failed and retryable (ERROR).
 *
 * A form keeps its engine enabled through a run with this, whatever its amount
 * check now says. That check reads live balances, and a multi-step run moves
 * them itself: a DAI/USDC savings supply spends the DAI or USDC its amount was
 * validated against once the conversion leg mines, and turning the engine off
 * there would stop the deposit (or a Retry of it) from simulating, stranding
 * the funds as USDS. Only the form's own checks are relaxed (the amount, and on
 * stUSDS the module cap and provider block, which the contracts and the
 * simulation still enforce) — the launch hooks' safety gates (the USDC supply's
 * PSM fee gate) stay live.
 *
 * Not SUCCESS: the run is over and nothing should re-simulate against the
 * post-send state.
 */
export function useTransactionRunActive(): boolean {
  const { txStatus } = useTransaction();
  return txStatus === TxStatus.INITIALIZED || txStatus === TxStatus.LOADING || txStatus === TxStatus.ERROR;
}
