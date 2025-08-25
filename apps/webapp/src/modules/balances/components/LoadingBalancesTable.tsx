import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { BalancesTableHeader } from './BalancesTableHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { INITIAL_TOKEN_COUNT } from './BalancesAssets';

export function LoadingBalancesTable() {
  return (
    <Table>
      <BalancesTableHeader />
      <TableBody>
        {[...Array(INITIAL_TOKEN_COUNT)].map((_, i) => (
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
