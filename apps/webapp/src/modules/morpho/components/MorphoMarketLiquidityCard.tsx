import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Token } from '@jetstreamgg/sky-hooks';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { useChainId } from 'wagmi';
import { useMorphoVaultMarketData } from '../hooks/useMorphoVaultMarketData';

type MorphoMarketLiquidityCardProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
};

export function MorphoMarketLiquidityCard({ vaultAddress, assetToken }: MorphoMarketLiquidityCardProps) {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const { data: marketData, isLoading } = useMorphoVaultMarketData({ vaultAddress });

  const liquidity = marketData?.liquidity ?? 0n;

  const assetDecimals =
    typeof assetToken.decimals === 'number'
      ? assetToken.decimals
      : (assetToken.decimals[chainId as keyof typeof assetToken.decimals] ?? 18);

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Available Liquidity`)}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: assetToken.symbol, name: assetToken.name }}
          balance={formatBigInt(liquidity, { unit: assetDecimals })}
        />
      }
    />
  );
}
