import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { useMorphoVaultOnChainData, Token } from '@jetstreamgg/sky-hooks';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { useChainId } from 'wagmi';

type MorphoVaultTvlCardProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
};

export function MorphoVaultTvlCard({ vaultAddress, assetToken }: MorphoVaultTvlCardProps) {
  const { i18n } = useLingui();
  const chainId = useChainId();
  const { data: vaultData, isLoading } = useMorphoVaultOnChainData({ vaultAddress });

  const totalAssets = vaultData?.totalAssets || 0n;
  const assetDecimals =
    typeof assetToken.decimals === 'number'
      ? assetToken.decimals
      : (assetToken.decimals[chainId as keyof typeof assetToken.decimals] ?? 18);

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      title={i18n._(msg`Total Value Locked`)}
      content={
        <TokenIconWithBalance
          className="mt-2"
          token={{ symbol: assetToken.symbol, name: assetToken.name }}
          balance={formatBigInt(totalAssets, { unit: assetDecimals })}
        />
      }
    />
  );
}
