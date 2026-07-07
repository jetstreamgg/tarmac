import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { useBorrowCapacityData } from '@/hooks';
import { UtilizationBar } from '@/widgets';
import { formatBigInt } from '@/utils';
import { Skeleton } from '@/components/ui/skeleton';

const NO_VALUE = '–';

function LegendRow({
  label,
  isLoading,
  error,
  children
}: {
  label: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-textSecondary text-sm">{label}</span>
      <span className="text-text text-sm font-medium">
        {isLoading ? <Skeleton className="h-4 w-16" /> : error ? NO_VALUE : children}
      </span>
    </div>
  );
}

/**
 * Statistics-tab borrow-utilization block (hi-fi 486:31955): the utilization
 * hero percentage, the shared UtilizationBar, and Borrowed/Available legend
 * rows — all fed by `useBorrowCapacityData`. Read-only; no engine hook touched.
 */
export function BorrowUtilizationBlock() {
  const { data, isLoading, error } = useBorrowCapacityData();
  const utilization = data?.borrowUtilization ?? 0;

  return (
    <div
      data-testid="stake-borrow-utilization"
      className="bg-panel rounded-card flex flex-col p-6 backdrop-blur-2xl"
    >
      <h3 className="text-text mb-4 text-lg font-medium">
        <Trans>Borrow Utilization</Trans>
      </h3>

      <div className="text-text mb-3 text-2xl font-semibold">
        {isLoading ? <Skeleton className="h-8 w-24" /> : error ? NO_VALUE : `${utilization.toFixed(1)}%`}
      </div>

      <UtilizationBar
        utilizationRate={utilization}
        isLoading={isLoading}
        showLabel={false}
        barHeight="h-2"
        className="mb-4"
      />

      <div className="flex flex-col gap-3">
        <LegendRow label={<Trans>Borrowed (USDS)</Trans>} isLoading={isLoading} error={error}>
          {data ? formatBigInt(data.totalDebt) : NO_VALUE}
        </LegendRow>
        <LegendRow label={<Trans>Available (USDS)</Trans>} isLoading={isLoading} error={error}>
          {data ? formatBigInt(data.borrowCapacity) : NO_VALUE}
        </LegendRow>
      </div>
    </div>
  );
}
