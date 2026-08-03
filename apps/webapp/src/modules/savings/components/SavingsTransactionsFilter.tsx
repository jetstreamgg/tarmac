import { ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { BP, useBreakpointIndex } from '@/hooks';
import { cn } from '@/lib/cn';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Action-type filter for the Savings transactions list. `all` shows every
 * transaction; `supply` / `withdraw` narrow to that action. The narrowing
 * itself runs in `SavingsTransactionsTable` over the data it already has — this
 * control only carries the selection.
 */
export type SavingsTxFilter = 'all' | 'supply' | 'withdraw';

export const SAVINGS_TX_FILTERS: SavingsTxFilter[] = ['all', 'supply', 'withdraw'];

function FilterLabel({ value, mobileTrigger = false }: { value: SavingsTxFilter; mobileTrigger?: boolean }) {
  if (value === 'supply') return <Trans>Supply</Trans>;
  if (value === 'withdraw') return <Trans>Withdraw</Trans>;
  // The mobile pill spells out its resting state (Figma 486:20830); the
  // desktop chip and the dropdown rows keep the short "All".
  if (mobileTrigger) return <Trans>All transactions</Trans>;
  return <Trans>All</Trans>;
}

/**
 * The transactions filter beside (desktop) or below (mobile) the has-position
 * "Transactions" heading, mounted through the `ProductDetailTemplate`
 * `transactionsAction` slot. Desktop is the Figma `All ▾` text chip (527:7204);
 * below `BP.md` it becomes the comp's full-width bordered pill labelled
 * "All transactions" (M6.3, Figma 486:20830).
 *
 * Purely presentational — it owns no state. The parent (`SavingsProductDetail`)
 * holds the active filter and feeds the same value to `SavingsTransactionsTable`.
 */
export function SavingsTransactionsFilter({
  value,
  onChange
}: {
  value: SavingsTxFilter;
  onChange: (next: SavingsTxFilter) => void;
}): ReactNode {
  const { bpi } = useBreakpointIndex();
  const isMobile = bpi < BP.md;

  return (
    <Select value={value} onValueChange={next => onChange(next as SavingsTxFilter)}>
      <SelectTrigger
        data-testid="savings-transactions-filter"
        aria-label={t`Filter transactions`}
        className={cn(
          'shrink-0 bg-transparent transition-colors focus-visible:ring-0',
          isMobile
            ? // Label 6 pill, 12px chevron ([&_svg] outranks the built-in h-4).
              'border-glassBorder text-text font-circle h-[30px] w-full justify-between rounded-full border py-2 pr-2 pl-3 text-xs leading-[14px] font-medium tracking-[-0.24px] [&_svg]:h-3 [&_svg]:w-3'
            : 'text-textSecondary hover:text-text font-circle h-auto w-auto gap-1.5 rounded-full border-none p-0 text-sm font-medium'
        )}
      >
        <SelectValue>
          <FilterLabel value={value} mobileTrigger={isMobile} />
        </SelectValue>
      </SelectTrigger>
      {/* Panel and rows are the DS Dropdown recipe (SelectContent/SelectItem defaults). */}
      <SelectContent>
        {SAVINGS_TX_FILTERS.map(filter => (
          <SelectItem key={filter} value={filter} data-testid={`savings-transactions-filter-${filter}`}>
            <FilterLabel value={filter} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
