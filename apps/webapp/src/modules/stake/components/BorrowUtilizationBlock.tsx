import { ReactNode } from 'react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/cn';
import { useBorrowCapacityData } from '@/hooks';
import { formatBigInt, formatDecimalPercentage } from '@/utils';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { RateInfo } from '@/components/product/RateInfo';
import { NO_VALUE } from '@/lib/constants';

// Hi-fi 486:31955 binds the utilized fill (and the Borrowed legend dot) to
// fg-brand-primary — the `fgBrand` token (#757dff), which is also the DS
// Progress Bar's default fill.
const UTILIZED_COLOR = 'bg-fgBrand';

function LegendRow({
  label,
  isLoading,
  error,
  dotColor = 'bg-fgSecondary/50',
  children
}: {
  label: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  dotColor?: string;
  children: ReactNode;
}) {
  // Hairlines under BOTH rows at every tier — the desktop comp closes the
  // legend under "Available (USDS)" too, which is the border APP-432 item 18
  // spotted missing (comp 1222:17089 for the phone geometry: 12px token icon,
  // Label 4 values).
  return (
    <div className="border-borderPrimary flex items-center justify-between gap-4 border-b pt-4 pb-3 md:pt-0">
      <span className="text-fgSecondary flex items-center gap-1.5 text-sm leading-[22px]">
        <span className={cn('h-1 w-1 shrink-0 rounded-full', dotColor)} aria-hidden />
        {label}
      </span>
      <span className="text-fgPrimary font-circle flex items-center gap-[3px] text-sm leading-4 font-medium tracking-[-0.28px] md:text-base md:leading-[18px] md:tracking-[-0.32px]">
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : error ? (
          NO_VALUE
        ) : (
          <>
            <TokenIcon token={{ symbol: 'USDS' }} width={12} className="h-3 w-3" showChainIcon={false} />
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
      {/* APP-600 (3617:23818): Label 3 title + debt-ceiling explainer, 16px to
          a Heading 3 figure; figure, bar and legend sit 20px apart. */}
      <h3 className="text-fgPrimary font-circle mb-4 flex items-center gap-2 text-base leading-[18px] font-medium tracking-[-0.32px] md:text-lg md:leading-[22px] md:tracking-[-0.36px]">
        <Trans>Borrow Utilization</Trans>
        <RateInfo type="dtc" size={12} />
      </h3>

      <div className="text-fgPrimary font-circle mb-5 text-2xl leading-[26px] font-medium tracking-[-0.48px] md:text-[32px] md:leading-[35px] md:tracking-[-0.64px]">
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : error ? (
          NO_VALUE
        ) : (
          formatDecimalPercentage(utilization / 100, 1)
        )}
      </div>

      {/* Flat fg-brand-primary fill per 486:31955 — the DS Progress default is
          the slider brand gradient, which this comp does not use. */}
      <Progress
        value={isLoading ? 0 : Math.min(100, utilization)}
        indicatorClassName={UTILIZED_COLOR}
        className="mb-5 h-1.5"
      />

      <div className="flex flex-col md:gap-4">
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
