import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Token } from '@jetstreamgg/sky-hooks';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { PopoverRateInfo as PopoverInfo } from '@jetstreamgg/sky-widgets';
import { useChainId } from 'wagmi';

type MorphoMarketLiquidityCardProps = {
  liquidity?: bigint;
  isLoading: boolean;
  error?: Error | null;
  assetToken: Token;
};

export function MorphoMarketLiquidityCard({
  liquidity,
  isLoading,
  error,
  assetToken
}: MorphoMarketLiquidityCardProps) {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const liquidityTooltip = `The amount of ${assetToken.symbol} currently idle in the Morpho market and available for immediate withdrawal or new borrowing.`;

  const assetDecimals =
    typeof assetToken.decimals === 'number'
      ? assetToken.decimals
      : (assetToken.decimals[chainId as keyof typeof assetToken.decimals] ?? 18);

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      error={error}
      title={
        <div className="flex items-center gap-1">
          <span>{i18n._(msg`Available liquidity`)}</span>
          <PopoverInfo
            type="morphoLiquidity"
            tooltipOverride={{ description: liquidityTooltip }}
            iconClassName="text-textSecondary"
            width={14}
            height={14}
          />
        </div>
      }
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: assetToken.symbol, name: assetToken.name }}
          balance={formatBigInt(liquidity || 0n, { unit: assetDecimals })}
        />
      }
    />
  );
}
