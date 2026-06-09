import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@/utils';
import { Token, VaultProvider } from '@/hooks';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { PopoverRateInfo as PopoverInfo } from '@/widgets';
import { useChainId } from 'wagmi';

type MorphoMarketLiquidityCardProps = {
  liquidity?: bigint;
  isLoading: boolean;
  error?: Error | null;
  assetToken: Token;
  /** Which provider operates the vault. Drives the liquidity tooltip wording. Defaults to Morpho. */
  provider?: VaultProvider;
};

export function MorphoMarketLiquidityCard({
  liquidity,
  isLoading,
  error,
  assetToken,
  provider = 'morpho'
}: MorphoMarketLiquidityCardProps) {
  const { i18n } = useLingui();
  const chainId = useChainId();
  // Spark/Tether vaults expose instant-withdrawal liquidity, not a Morpho market.
  const liquidityTooltip =
    provider === 'sky'
      ? `The amount of ${assetToken.symbol} currently available for instant withdrawal.`
      : `The amount of ${assetToken.symbol} currently idle in the Morpho market and available for immediate withdrawal or new borrowing.`;

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
          dataTestId="vault-info-liquidity"
          token={{ symbol: assetToken.symbol, name: assetToken.name }}
          balance={formatBigInt(liquidity || 0n, { unit: assetDecimals })}
        />
      }
    />
  );
}
