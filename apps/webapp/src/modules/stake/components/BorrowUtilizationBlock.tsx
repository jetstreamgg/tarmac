import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useBorrowCapacityData } from '@/hooks';
import { formatBigInt } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const NO_VALUE = '–';

// Hi-fi 486:31955 binds the utilized fill (and the Borrowed legend dot) to
// fg-brand-primary — the `fgBrand` token (#757dff), which is also the DS
// Progress Bar's default fill.
const UTILIZED_COLOR = 'bg-fgBrand';

function LegendRow({
  label,
  isLoading,
  error,
  dotColor = 'bg-textSecondary/50',
  children
}: {
  label: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  dotColor?: string;
  children: ReactNode;
}) {
  return (
    <div className="border-textSecondary/10 flex items-center justify-between gap-4 border-b py-3 last:border-b-0">
      <span className="text-textSecondary flex items-center gap-2 text-sm">
        <span className={cn('h-1 w-1 shrink-0 rounded-full', dotColor)} aria-hidden />
        {label}
      </span>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : error ? (
          NO_VALUE
        ) : (
          <>
            <TokenIcon token={{ symbol: 'USDS' }} width={16} className="h-4 w-4" showChainIcon={false} />
            {children}
          </>
        )}
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
    <div data-testid="stake-borrow-utilization" className="flex flex-col">
      <h3 className="text-text mb-4 flex items-center gap-1.5 text-lg font-medium">
        <Trans>Borrow Utilization</Trans>
        <Info className="text-textSecondary h-4 w-4" aria-hidden />
      </h3>

      <div className="text-text mb-3 text-2xl font-semibold">
        {isLoading ? <Skeleton className="h-8 w-24" /> : error ? NO_VALUE : `${utilization.toFixed(1)}%`}
      </div>

      <Progress value={isLoading ? 0 : Math.min(100, utilization)} className="mb-4 h-2" />

      <div className="flex flex-col gap-3">
        <LegendRow
          label={<Trans>Borrowed (USDS)</Trans>}
          isLoading={isLoading}
          error={error}
          dotColor={UTILIZED_COLOR}
        >
          {data ? formatBigInt(data.totalDebt) : NO_VALUE}
        </LegendRow>
        <LegendRow label={<Trans>Available (USDS)</Trans>} isLoading={isLoading} error={error}>
          {data ? formatBigInt(data.borrowCapacity) : NO_VALUE}
        </LegendRow>
      </div>
    </div>
  );
}
