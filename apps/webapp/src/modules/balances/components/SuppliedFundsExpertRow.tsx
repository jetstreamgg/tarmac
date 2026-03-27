import { TableCell, TableRow } from '@/components/ui/table';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { formatNumber } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { PopoverRateInfo, MorphoVaultBadge } from '@jetstreamgg/sky-widgets';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/utils';

type ProductBalance = {
  productName: string;
  balance: bigint;
  rate?: string;
  isMorpho?: boolean;
};

type SuppliedFundsExpertRowProps = {
  totalBalance: bigint;
  balancesByProduct: ProductBalance[];
  usdPrice: string | undefined;
  maxRate: string;
  isLoading?: boolean;
};

export function SuppliedFundsExpertRow({
  totalBalance,
  balancesByProduct,
  usdPrice,
  maxRate,
  isLoading
}: SuppliedFundsExpertRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const sortedBalancesByProduct = [...balancesByProduct].sort((a, b) =>
    a.balance === b.balance ? 0 : a.balance > b.balance ? -1 : 1
  );
  const nonZeroBalancesByProduct = sortedBalancesByProduct.filter(p => p.balance > 0n);

  const formattedAmount = formatNumber(parseFloat(formatUnits(totalBalance, 18)), {
    maxDecimals: 2,
    compact: true
  });

  const usdValue = usdPrice
    ? formatNumber(parseFloat(formatUnits(totalBalance, 18)) * parseFloat(usdPrice), {
        maxDecimals: 2,
        compact: true
      })
    : '--';

  const hasMultipleProducts = nonZeroBalancesByProduct.length > 1;

  return (
    <>
      <TableRow
        className={cn(
          'border-b-selectBorder',
          isOpen && 'border-b-0',
          // On narrow screens with multiple products, the sub-row handles the border
          hasMultipleProducts && '[@container(width<750px)]:border-b-0',
          // Override default hover and use shared hover state on tablet
          hasMultipleProducts && '[@container(width<750px)]:has-[td]:hover:bg-transparent',
          isHovered && hasMultipleProducts && '[@container(width<750px)]:!bg-surface/50'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TableCell className="h-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/images/expert_icon_large.svg" alt="Expert" className="h-5 w-5 flex-shrink-0" />
            <Text className="truncate">
              <Trans>Supplied to Expert</Trans>
            </Text>
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
          <div className="flex items-center justify-between gap-2">
            {isLoading ? (
              <Skeleton className="h-4 w-20" />
            ) : (
              <div className="flex items-center gap-1">
                <Text variant="small" className="text-bullish whitespace-nowrap">
                  <Trans>Rates up to:</Trans> {maxRate}
                </Text>
                <PopoverRateInfo type="expert" iconClassName="h-[13px] w-[13px]" />
              </div>
            )}
            {hasMultipleProducts && (
              <button className="flex items-center gap-1.5" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center -space-x-1">
                  {nonZeroBalancesByProduct.map(({ productName, isMorpho }, index, arr) => (
                    <div
                      key={productName}
                      style={{ zIndex: arr.length - index }}
                      className={cn('transition-opacity duration-200', isOpen && 'opacity-0')}
                    >
                        {isMorpho ? (
                          <MorphoVaultBadge />
                        ) : (
                          <TokenIcon
                            className="h-4 w-4"
                            token={{ symbol: 'stUSDS', name: 'stUSDS' }}
                            showChainIcon={false}
                          />
                        )}
                      </div>
                    ))}
                </div>
                <Text variant="small" className="text-textSecondary whitespace-nowrap">
                  <Trans>Funds by product</Trans>
                </Text>
                <ChevronDown
                  className={cn(
                    'text-textSecondary h-3 w-3 transition-transform duration-200',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Funds by product sub-row - visible on narrow/tablet screens */}
      {hasMultipleProducts && (
        <TableRow
          className={cn(
            'hidden border-0 [@container(width<750px)]:table-row',
            !isOpen && 'border-b-selectBorder border-b',
            // Override default hover and use shared hover state on tablet
            'has-[td]:hover:bg-transparent',
            isHovered && '!bg-surface/50'
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <TableCell className="h-auto px-4 pt-0 pb-3">
            <button className="flex w-full items-center justify-between" onClick={() => setIsOpen(!isOpen)}>
              <div className="flex items-center -space-x-1">
                {nonZeroBalancesByProduct.map(({ productName, isMorpho }, index, arr) => (
                    <div
                      key={productName}
                      style={{ zIndex: arr.length - index }}
                      className={cn('transition-opacity duration-200', isOpen && 'opacity-0')}
                    >
                      {isMorpho ? (
                        <MorphoVaultBadge />
                      ) : (
                        <TokenIcon
                          className="h-4 w-4"
                          token={{ symbol: 'stUSDS', name: 'stUSDS' }}
                          showChainIcon={false}
                        />
                      )}
                    </div>
                  ))}
              </div>
            </button>
          </TableCell>
          <TableCell className="h-auto px-4 pt-0 pb-3">
            <button className="flex w-full items-center justify-end gap-1" onClick={() => setIsOpen(!isOpen)}>
              <Text variant="small" className="text-textSecondary whitespace-nowrap">
                <Trans>Funds by product</Trans>
              </Text>
              <ChevronDown
                className={cn(
                  'text-textSecondary h-3 w-3 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
          </TableCell>
        </TableRow>
      )}

      {/* Expandable product rows */}
      {isOpen &&
        nonZeroBalancesByProduct.map(({ productName, balance, rate, isMorpho }, index, filteredArray) => {
            const productUsdValue = usdPrice
              ? formatNumber(parseFloat(formatUnits(balance, 18)) * parseFloat(usdPrice), {
                  maxDecimals: 2,
                  compact: true
                })
              : '--';
            const productAmount = formatNumber(parseFloat(formatUnits(balance, 18)), {
              maxDecimals: 2,
              compact: true
            });
            const isLast = index === filteredArray.length - 1;

            return (
              <TableRow
                key={productName}
                className={cn('hover:bg-surface/50 border-0', isLast && 'border-b-selectBorder border-b')}
              >
                <TableCell className="h-auto py-2 pr-0 pl-8">
                  <div className="flex items-center gap-2">
                    {isMorpho ? (
                      <MorphoVaultBadge />
                    ) : (
                      <TokenIcon
                        className="h-5 w-5"
                        token={{ symbol: 'stUSDS', name: 'stUSDS' }}
                        showChainIcon={false}
                      />
                    )}
                    <Text className="text-[14px] whitespace-nowrap">{productName}</Text>
                  </div>
                </TableCell>
                <TableCell className="h-auto px-4 py-2">
                  <Text className="text-[14px]">{productAmount}</Text>
                </TableCell>
                <TableCell className="h-auto px-4 py-2 [@container(width<750px)]:hidden">
                  <Text className="text-textSecondary text-[13px]">${productUsdValue}</Text>
                </TableCell>
                <TableCell className="h-auto px-4 py-2 [@container(width<750px)]:hidden">
                  {rate && (
                    <Text variant="small" className="text-bullish whitespace-nowrap">
                      {rate}
                    </Text>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
    </>
  );
}
