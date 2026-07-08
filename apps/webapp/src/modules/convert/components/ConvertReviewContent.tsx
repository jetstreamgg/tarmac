import { formatUnits } from 'viem';
import { formatNumber, getChainIcon } from '@/utils';
import { Text } from '@/modules/layout/components/Typography';
import { TokenIcon } from '@/modules/ui/components/TokenIcon';
import { ArrowDown } from '@/modules/icons';
import { buildConvertModalRows, type ConvertModalRow } from './convertModalRows';

const formatAmount = (amount: bigint, decimals: number) =>
  formatNumber(parseFloat(formatUnits(amount, decimals)), { maxDecimals: 2 });

function TokenChip({ symbol }: { symbol: string }) {
  return (
    <span className="bg-glassBadge flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1">
      <TokenIcon token={{ symbol }} width={16} showChainIcon={false} className="h-4 w-4" />
      <Text className="text-text text-sm font-medium">{symbol}</Text>
    </span>
  );
}

function ReviewRow({ row, chainId }: { row: ConvertModalRow; chainId: number }) {
  return (
    <div className="flex items-center justify-between" data-testid={`convert-modal-row-${row.id}`}>
      <Text className="text-textSecondary text-sm">{row.label}</Text>
      <span className="text-text flex items-center gap-1.5 text-sm font-medium">
        {row.kind === 'network' && getChainIcon(chainId, 'h-4 w-4')}
        <Text className="text-text text-sm font-medium">{row.value}</Text>
      </span>
    </div>
  );
}

/**
 * Read-only body for the "Review conversion" modal (Figma 486:32223), passed to
 * `launch()` as `transactionContent`. From amount → To amount with token chips,
 * then the `buildConvertModalRows` detail rows. Amounts are display-only — the
 * engine (`usePsmConversion`) owns the calldata this screen previews.
 */
export function ConvertReviewContent({
  originSymbol,
  targetSymbol,
  originAmount,
  targetAmount,
  originDecimals,
  targetDecimals,
  chainId,
  networkName,
  networkFee
}: {
  originSymbol: string;
  targetSymbol: string;
  originAmount: bigint;
  targetAmount: bigint;
  originDecimals: number;
  targetDecimals: number;
  chainId: number;
  networkName: string;
  networkFee: string;
}) {
  const rows = buildConvertModalRows({
    originSymbol,
    targetSymbol,
    network: networkName,
    networkFee
  });

  return (
    <div className="flex flex-col gap-4" data-testid="convert-modal-review">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <TokenIcon
              token={{ symbol: originSymbol }}
              width={28}
              showChainIcon={false}
              className="h-7 w-7 shrink-0"
            />
            <Text className="text-text truncate text-2xl font-medium" dataTestId="convert-modal-from-amount">
              {formatAmount(originAmount, originDecimals)}
            </Text>
          </span>
          <TokenChip symbol={originSymbol} />
        </div>
        {/* Icon SVGs don't inherit currentColor — fill must be set explicitly
            (same convention as the history tables' light:fill-text fill-white). */}
        <span aria-hidden className="pl-2">
          <ArrowDown width={10} height={14} className="fill-textSecondary" />
        </span>
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2.5">
            <TokenIcon
              token={{ symbol: targetSymbol }}
              width={28}
              showChainIcon={false}
              className="h-7 w-7 shrink-0"
            />
            <Text className="text-text truncate text-2xl font-medium" dataTestId="convert-modal-to-amount">
              {formatAmount(targetAmount, targetDecimals)}
            </Text>
          </span>
          <TokenChip symbol={targetSymbol} />
        </div>
      </div>

      <div className="border-border flex flex-col gap-3 border-t pt-4">
        {rows.map(row => (
          <ReviewRow key={row.id} row={row} chainId={chainId} />
        ))}
      </div>
    </div>
  );
}
