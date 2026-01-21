import { TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Text } from '@/modules/layout/components/Typography';
import { Trans } from '@lingui/react/macro';

export function SuppliedFundsTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-1/5">
          <Text variant="small">
            <Trans>Token</Trans>
          </Text>
        </TableHead>
        <TableHead className="w-1/5">
          <Text variant="small">
            <Trans>Module</Trans>
          </Text>
        </TableHead>
        <TableHead className="w-1/5">
          <Text variant="small">
            <Trans>Amount</Trans>
          </Text>
        </TableHead>
        <TableHead className="w-1/5 [@container(width<750px)]:hidden">
          <Text variant="small">
            <Trans>Amount (USD)</Trans>
          </Text>
        </TableHead>
        <TableHead className="w-1/5 [@container(width<750px)]:hidden">
          <Text variant="small">
            <Trans>Rates</Trans>
          </Text>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}
