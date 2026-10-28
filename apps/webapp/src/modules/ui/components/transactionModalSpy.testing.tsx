import type { TransactionFlowProps } from '@/modules/ui/context/transactionContract';

/**
 * Test-only stand-in for `TransactionModal` in a flow's own tests: records every
 * render's props through `record` and renders the entry body (or the review), so a
 * test reads what the flow hands the modal without a provider.
 */
export function transactionModalSpy(record: (props: TransactionFlowProps) => void) {
  return {
    TransactionModal: (props: TransactionFlowProps) => {
      record(props);
      return <>{props.entry ? props.entry.content : props.transactionContent}</>;
    }
  };
}
