import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDown } from '@/modules/icons';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';
import { HistoryTableProps, SortDirection } from './types';

export function HistoryTableHeader({
  transactionHeader,
  typeColumn,
  typeHeader,
  statusColumn,
  toggleSortDirection,
  sortDirection
}: Pick<HistoryTableProps, 'transactionHeader' | 'typeHeader' | 'typeColumn' | 'statusColumn'> & {
  toggleSortDirection: () => void;
  sortDirection: SortDirection;
}) {
  return (
    <TableHeader className="hidden xl:table-header-group">
      <TableRow>
        <TableHead colSpan={3}>
          <Text variant="small">{transactionHeader}</Text>
        </TableHead>
        {typeColumn && (
          <TableHead>
            <Text variant="small">{typeHeader}</Text>
          </TableHead>
        )}
        {statusColumn && (
          <TableHead>
            <Text variant="small">Status</Text>
          </TableHead>
        )}
        <TableHead className="flex h-full justify-end">
          <div className="flex cursor-pointer gap-2" onClick={toggleSortDirection}>
            <Text variant="small">
              <Trans>Date</Trans>
            </Text>
            <ArrowDown
              className={`fill-selectActive light:fill-textSecondary transition-all ${sortDirection === SortDirection.asc ? 'rotate-180' : ''}`}
              width={10}
              height={14}
            />
          </div>
        </TableHead>
        <TableHead className="text-right">
          <Text variant="small">
            <Trans>Tx hash</Trans>
          </Text>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
