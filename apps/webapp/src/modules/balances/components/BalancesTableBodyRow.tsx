import { TableCell, TableRow } from '@/components/ui/table';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { OracleInfo } from './OracleInfo';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';

type TokenBalance = {
  valueInDollars: number;
  value: bigint;
  decimals: number;
  formatted: string;
  symbol: string;
  chainId: number;
};

export function BalancesTableBodyRow({
  isLoading,
  error,
  price,
  tokenBalance
}: {
  isLoading: boolean;
  error: Error | null;
  price: string | undefined;
  tokenBalance: TokenBalance;
}) {
  const { chainId, symbol } = tokenBalance;

  return (
    <TableRow>
      <TableCell className="h-auto px-4 py-2">
        <div className="flex items-center gap-2">
          <TokenIcon className="h-5 w-5" token={{ symbol, name: symbol }} chainId={chainId} />
          <Text>{symbol}</Text>
        </div>
      </TableCell>
      <TableCell className="h-auto px-4 py-2">
        <OracleInfo
          isLoading={isLoading}
          info={price ? `$${formatNumber(parseFloat(price), { maxDecimals: 2 })}` : '--'}
          error={error}
        />
      </TableCell>
      <TableCell className="h-auto px-4 py-2">
        <Text>{formatNumber(parseFloat(tokenBalance.formatted), { maxDecimals: 0, compact: true })}</Text>
      </TableCell>
      <TableCell className="h-auto px-4 py-2 [@container(width<375px)]:hidden">
        <OracleInfo
          isLoading={isLoading}
          info={`$${formatNumber(
            parseFloat(formatUnits(tokenBalance?.value || 0n, tokenBalance?.decimals || 18)) *
              parseFloat(price || '0'),
            { maxDecimals: 2, compact: true }
          )}`}
          error={error}
        />
      </TableCell>
    </TableRow>
  );
}
