import type { ReactNode } from 'react';
import { Text } from '@/modules/layout/components/Typography';

/**
 * Content for a transaction-lifecycle notice toast (abandoned wallet request,
 * new-flow blocked by a confirming tx): a status icon, a short bold header, and
 * a secondary body line — same visual weight as MinimizedTransactionToast. The
 * close (X) comes from the `toastWithClose` wrapper.
 */
export function TransactionNoticeToast({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
}) {
  return (
    <div className="flex w-full items-center gap-4 pr-6" data-testid="transaction-notice-toast">
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <Text className="text-text font-medium">{title}</Text>
        <Text className="text-textSecondary text-sm">{description}</Text>
      </span>
    </div>
  );
}
