import type { ReactNode } from 'react';
import { TxStatus, InProgress, SuccessCheck, FailedX } from '@/widgets';
import { Text } from '@/modules/layout/components/Typography';
import { formatAddress } from '@/utils';

const statusIcon: Partial<Record<TxStatus, ReactNode>> = {
  [TxStatus.INITIALIZED]: <InProgress />,
  [TxStatus.LOADING]: <InProgress />,
  [TxStatus.SUCCESS]: <SuccessCheck />,
  [TxStatus.ERROR]: <FailedX />
};

/**
 * Content for the toast shown while a transaction modal is minimized (Figma: a
 * status icon, an amount-aware title, and the shortened tx hash). The whole row is
 * a button that re-opens the modal; the close (X) comes from the `toastWithClose`
 * wrapper. The hash is omitted until one exists (batch txs have none while pending).
 */
export function MinimizedTransactionToast({
  status,
  title,
  hash,
  onView
}: {
  status: TxStatus;
  title: string;
  hash?: string;
  onView: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onView}
      className="flex w-full items-center gap-4 pr-6 text-left"
      data-testid="minimized-transaction-toast"
    >
      <span className="shrink-0">{statusIcon[status]}</span>
      <span className="flex flex-col">
        <Text className="text-text font-medium">{title}</Text>
        {hash && <Text className="text-textSecondary text-sm">{formatAddress(hash, 6, 4)}</Text>}
      </span>
    </button>
  );
}
