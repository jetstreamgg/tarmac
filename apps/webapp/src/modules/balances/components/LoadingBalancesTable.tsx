import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { BalancesTableHeader } from './BalancesTableHeader';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingBalancesTable() {
  return (
    <Table>
      <BalancesTableHeader />
      <TableBody>
        {[...Array(10)].map((_, i) => (
          <TableRow key={i}>
            {[...Array(4)].map((_, j) => (
              <TableCell key={j} className="h-auto px-4 py-2">
                <Skeleton className="h-4 w-20" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
