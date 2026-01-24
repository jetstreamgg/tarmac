import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { Token, MorphoMarketAllocation } from '@jetstreamgg/sky-hooks';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { useChainId } from 'wagmi';

type MorphoMarketBorrowCardProps = {
  market?: MorphoMarketAllocation;
  isLoading: boolean;
  assetToken: Token;
};

export function MorphoMarketBorrowCard({ market, isLoading, assetToken }: MorphoMarketBorrowCardProps) {
  const { i18n } = useLingui();
  const chainId = useChainId();

  const totalBorrow = market?.totalBorrowAssets ?? 0n;

  const assetDecimals =
    typeof assetToken.decimals === 'number'
      ? assetToken.decimals
      : (assetToken.decimals[chainId as keyof typeof assetToken.decimals] ?? 18);

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Market Borrowed`)}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: assetToken.symbol, name: assetToken.name }}
          balance={formatBigInt(totalBorrow, { unit: assetDecimals })}
        />
      }
    />
  );
}
