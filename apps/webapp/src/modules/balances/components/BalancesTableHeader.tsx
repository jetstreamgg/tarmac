import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Text } from '@/modules/layout/components/Typography';

export function BalancesTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-1/4">
          <Text variant="small">Token</Text>
        </TableHead>
        <TableHead className="w-1/4">
          <Text variant="small">Price</Text>
        </TableHead>
        <TableHead className="w-1/4">
          <Text variant="small">Balance</Text>
        </TableHead>
        <TableHead className="w-1/4 [@container(width<375px)]:hidden">
          <Text variant="small">Balance (USD)</Text>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
