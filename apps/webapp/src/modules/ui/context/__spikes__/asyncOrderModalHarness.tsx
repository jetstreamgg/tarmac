import { useRef, useState } from 'react';
import { TxStatus } from '@/widgets';
import { TransactionModal } from '@/modules/ui/components/TransactionModal';
import type { AsyncOrderConfig, AsyncOrderStatus } from '../transactionContract';

// A3 spike — throwaway. Proves an AsyncOrderConfig can drive the real
// TransactionModal through an order's no-receipt lifecycle. Not production code.
// DELETE when E3 (CoW/ETH-flow migration) lands — its order-lifecycle V2 spec
// supersedes this harness. Keep transactionContract.type.test.ts.

const TX_STATUS_BY_ORDER: Record<AsyncOrderStatus, TxStatus> = {
  presignaturePending: TxStatus.LOADING,
  open: TxStatus.LOADING,
  fulfilled: TxStatus.SUCCESS,
  cancelled: TxStatus.CANCELLED,
  expired: TxStatus.ERROR
};

const isPending = (status: AsyncOrderStatus) => status === 'presignaturePending' || status === 'open';

export function AsyncOrderModalHarness({ config }: { config: AsyncOrderConfig }) {
  const [open, setOpen] = useState(true);
  const [txStatus, setTxStatus] = useState<TxStatus>(TxStatus.IDLE);
  const orderIdRef = useRef<string | undefined>(undefined);

  const poll = (id: string) => {
    void config.pollOrderStatus(id).then(status => {
      setTxStatus(TX_STATUS_BY_ORDER[status]);
      if (isPending(status)) {
        setTimeout(() => poll(id), config.pollIntervalMs ?? 2000);
      } else if (status === 'fulfilled') {
        config.onSuccess?.();
      } else if (status === 'expired') {
        config.onError?.();
      }
    });
  };

  // Sign + POST once; retry re-polls the same order rather than re-signing.
  const start = () => {
    if (orderIdRef.current) {
      poll(orderIdRef.current);
      return;
    }
    setTxStatus(TxStatus.INITIALIZED);
    void config.submitOrder().then(id => {
      orderIdRef.current = id;
      poll(id);
    });
  };

  return (
    <TransactionModal
      open={open}
      onClose={() => setOpen(false)}
      title={config.title}
      subtitles={config.subtitles}
      transactionContent={config.transactionContent}
      rightHeaderComponent={config.rightHeaderComponent}
      onConfirm={start}
      onRetry={start}
      txStatus={txStatus}
      confirmLabel={config.confirmLabel}
      confirmDisabled={config.confirmDisabled}
      successLabel={config.successLabel}
      errorLabel={config.errorLabel}
      steps={config.steps}
    />
  );
}
