import { ReactNode } from 'react';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Action-type filter for the Savings transactions list. `all` shows every
 * transaction; `supply` / `withdraw` narrow to that action. The narrowing
 * itself runs in `SavingsTransactionsTable` over the data it already has — this
 * control only carries the selection.
 */
export type SavingsTxFilter = 'all' | 'supply' | 'withdraw';

export const SAVINGS_TX_FILTERS: SavingsTxFilter[] = ['all', 'supply', 'withdraw'];

function FilterLabel({ value }: { value: SavingsTxFilter }) {
  if (value === 'supply') return <Trans>Supply</Trans>;
  if (value === 'withdraw') return <Trans>Withdraw</Trans>;
  return <Trans>All</Trans>;
}

/**
 * The Figma `All ▾` filter shown beside the has-position "Transactions" heading
 * (node 527:7204), mounted through the `ProductDetailTemplate` `transactionsAction`
 * slot. The no-position page omits it (it always shows the full list).
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
  return (
    <Select value={value} onValueChange={next => onChange(next as SavingsTxFilter)}>
      <SelectTrigger
        data-testid="savings-transactions-filter"
        aria-label={t`Filter transactions`}
        className="text-textSecondary hover:text-text h-auto w-auto shrink-0 gap-1.5 rounded-full border-none bg-transparent p-0 text-sm font-medium transition-colors focus:ring-0 focus:ring-offset-0"
      >
        <SelectValue>
          <FilterLabel value={value} />
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
