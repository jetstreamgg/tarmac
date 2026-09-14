import { StatsCard } from '@/modules/ui/components/StatsCard';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { formatBigInt } from '@/utils';
import { getTokenDecimals, Token } from '@/hooks';
import { TokenIconWithBalance } from '@/modules/ui/components/TokenIconWithBalance';
import { useChainId } from 'wagmi';

type VaultTvlCardProps = {
  /** Total assets held by the vault (TVL), in the asset's smallest unit. */
  totalAssets?: bigint;
  isLoading: boolean;
  error?: Error | null;
  assetToken: Token;
};

/**
 * Presentational Total Value Locked sub-card. Provider-neutral: the parent
 * supplies `totalAssets` from the appropriate source (Morpho market API or
 * on-chain ERC-4626 `totalAssets`).
 */
export function VaultTvlCard({ totalAssets, isLoading, error, assetToken }: VaultTvlCardProps) {
  const { i18n } = useLingui();
  const chainId = useChainId();

  const assetDecimals = getTokenDecimals(assetToken, chainId);

  return (
    <StatsCard
      className="h-full"
      isLoading={isLoading}
      error={error}
      title={i18n._(msg`Total Value Locked`)}
      content={
        <TokenIconWithBalance
          className="mt-2"
          dataTestId="vault-info-tvl"
          token={{ symbol: assetToken.symbol, name: assetToken.name }}
          balance={totalAssets !== undefined ? formatBigInt(totalAssets, { unit: assetDecimals }) : '--'}
        />
      }
    />
  );
}
