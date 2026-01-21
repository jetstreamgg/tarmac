import { TableCell, TableRow } from '@/components/ui/table';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { PopoverRateInfo, type PopoverTooltipType } from '@jetstreamgg/sky-widgets';
import { Skeleton } from '@/components/ui/skeleton';
import { ReactNode } from 'react';

export type SuppliedFundsRowData = {
  tokenSymbol: string;
  moduleIcon: ReactNode;
  moduleName: string;
  amount: bigint;
  decimals: number;
  usdPrice: string | undefined;
  rateText: string;
  ratePopoverType: PopoverTooltipType;
  isRateUpTo?: boolean;
  chainId?: number;
};

type SuppliedFundsTableRowProps = {
  data: SuppliedFundsRowData;
  isLoading?: boolean;
  children?: ReactNode;
};

export function SuppliedFundsTableRow({ data, isLoading, children }: SuppliedFundsTableRowProps) {
  const {
    tokenSymbol,
    moduleIcon,
    moduleName,
    amount,
    decimals,
    usdPrice,
    rateText,
    ratePopoverType,
    isRateUpTo = false,
    chainId
  } = data;

  const formattedAmount = formatNumber(parseFloat(formatUnits(amount, decimals)), {
    maxDecimals: 2,
    compact: true
  });

  const usdValue = usdPrice
    ? formatNumber(parseFloat(formatUnits(amount, decimals)) * parseFloat(usdPrice), {
        maxDecimals: 2,
        compact: true
      })
    : '--';

  return (
    <>
      <TableRow className="border-b-selectBorder">
        <TableCell className="h-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <TokenIcon
              className="h-6 w-6"
              token={{ symbol: tokenSymbol, name: tokenSymbol }}
              chainId={chainId}
            />
            <Text>{tokenSymbol}</Text>
          </div>
        </TableCell>
        <TableCell className="h-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 flex-shrink-0">{moduleIcon}</div>
            <Text className="truncate">{moduleName}</Text>
          </div>
        </TableCell>
        <TableCell className="h-auto px-4 py-3">
          {isLoading ? <Skeleton className="h-4 w-16" /> : <Text>{formattedAmount}</Text>}
        </TableCell>
        <TableCell className="h-auto px-4 py-3 [@container(width<750px)]:hidden">
          {isLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : (
            <Text className="text-textSecondary text-[13px]">${usdValue}</Text>
          )}
        </TableCell>
        <TableCell className="h-auto px-4 py-3 [@container(width<750px)]:hidden">
          {isLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <div className="flex items-center gap-1">
              <Text variant="small" className="text-bullish whitespace-nowrap">
                {isRateUpTo ? `Up to: ${rateText}` : rateText}
              </Text>
              <PopoverRateInfo type={ratePopoverType} iconClassName="h-[13px] w-[13px]" />
            </div>
          )}
        </TableCell>
      </TableRow>
      {children}
    </>
  );
}
