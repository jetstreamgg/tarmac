import { TableCell, TableRow } from '@/components/ui/table';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { formatNumber, getChainIcon } from '@jetstreamgg/sky-utils';
import { formatUnits } from 'viem';
import { PopoverRateInfo } from '@jetstreamgg/sky-widgets';
import { Skeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useChains } from 'wagmi';
import { Trans } from '@lingui/react/macro';
import { cn } from '@/lib/utils';

type NetworkBalance = {
  chainId: number;
  balance: bigint;
};

type SuppliedFundsSavingsRowProps = {
  totalBalance: bigint;
  balancesByNetwork: NetworkBalance[];
  usdPrice: string | undefined;
  rate: string;
  isLoading?: boolean;
};

export function SuppliedFundsSavingsRow({
  totalBalance,
  balancesByNetwork,
  usdPrice,
  rate,
  isLoading
}: SuppliedFundsSavingsRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const chains = useChains();

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

  const hasMultipleNetworks = balancesByNetwork.length > 1;

  return (
    <>
      <TableRow
        className={cn(
          'border-b-selectBorder',
          isOpen && 'border-b-0',
          // On narrow screens with multiple networks, the sub-row handles the border
          hasMultipleNetworks && '[@container(width<750px)]:border-b-0',
          // Override default hover and use shared hover state on tablet
          hasMultipleNetworks && '[@container(width<750px)]:has-[td]:hover:bg-transparent',
          isHovered && hasMultipleNetworks && '[@container(width<750px)]:!bg-surface/50'
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TableCell className="h-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <TokenIcon className="h-6 w-6" token={{ symbol: 'sUSDS', name: 'sUSDS' }} showChainIcon={false} />
            <Text>sUSDS</Text>
          </div>
        </TableCell>
        <TableCell className="h-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/images/savings_icon_large.svg" alt="Savings" className="h-5 w-5 flex-shrink-0" />
            <Text className="truncate">
              <Trans>Savings</Trans>
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
                  {rate}
                </Text>
                <PopoverRateInfo type="ssr" iconClassName="h-[13px] w-[13px]" />
              </div>
            )}
            {hasMultipleNetworks && (
              <button className="flex items-center gap-1.5" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center -space-x-1">
                  {balancesByNetwork.slice(0, 5).map(({ chainId }, index) => (
                    <div
                      key={chainId}
                      style={{ zIndex: balancesByNetwork.length - index }}
                      className={cn('transition-opacity duration-200', isOpen && 'opacity-0')}
                    >
                      {getChainIcon(chainId, 'h-4 w-4')}
                    </div>
                  ))}
                </div>
                <Text variant="small" className="text-textSecondary whitespace-nowrap">
                  <Trans>Funds by network</Trans>
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

      {/* Funds by network sub-row - visible on narrow/tablet screens */}
      {hasMultipleNetworks && (
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
                {balancesByNetwork.slice(0, 5).map(({ chainId }, index) => (
                  <div
                    key={chainId}
                    style={{ zIndex: balancesByNetwork.length - index }}
                    className={cn('transition-opacity duration-200', isOpen && 'opacity-0')}
                  >
                    {getChainIcon(chainId, 'h-4 w-4')}
                  </div>
                ))}
              </div>
            </button>
          </TableCell>
          <TableCell className="h-auto px-4 pt-0 pb-3" colSpan={2}>
            <button className="flex w-full items-center justify-end gap-1" onClick={() => setIsOpen(!isOpen)}>
              <Text variant="small" className="text-textSecondary whitespace-nowrap">
                <Trans>Funds by network</Trans>
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

      {/* Expandable network rows */}
      {isOpen &&
        balancesByNetwork.map(({ chainId, balance }, index) => {
          const networkName = chains.find(c => c.id === chainId)?.name ?? `Chain ${chainId}`;
          const networkUsdValue = usdPrice
            ? formatNumber(parseFloat(formatUnits(balance, 18)) * parseFloat(usdPrice), {
                maxDecimals: 2,
                compact: true
              })
            : '--';
          const networkAmount = formatNumber(parseFloat(formatUnits(balance, 18)), {
            maxDecimals: 2,
            compact: true
          });
          const isLast = index === balancesByNetwork.length - 1;

          return (
            <TableRow
              key={chainId}
              className={cn('hover:bg-surface/50 border-0', isLast && 'border-b-selectBorder border-b')}
            >
              <TableCell className="h-auto py-2 pr-0 pl-8" colSpan={2}>
                <div className="flex items-center gap-2">
                  <TokenIcon className="h-5 w-5" token={{ symbol: 'USDS', name: 'USDS' }} chainId={chainId} />
                  <Text className="text-[14px] whitespace-nowrap">{networkName}</Text>
                </div>
              </TableCell>
              <TableCell className="h-auto px-4 py-2">
                <Text className="text-[14px]">{networkAmount}</Text>
              </TableCell>
              <TableCell className="h-auto px-4 py-2 [@container(width<750px)]:hidden">
                <Text className="text-textSecondary text-[13px]">${networkUsdValue}</Text>
              </TableCell>
              <TableCell className="h-auto px-4 py-2 [@container(width<750px)]:hidden" />
            </TableRow>
          );
        })}
    </>
  );
}
