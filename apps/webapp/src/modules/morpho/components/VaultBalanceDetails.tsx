import { useMorphoVaultOnChainData, useTokenBalance, Token, VaultProvider } from '@/hooks';
import { formatBigInt } from '@/utils';
import { SuppliedBalanceCard, UnsuppliedBalanceCard } from '@/modules/ui/components/BalanceCards';
import { t } from '@lingui/core/macro';
import { useChainId, useConnection } from 'wagmi';
import { MorphoVaultRewardsDetails } from './MorphoVaultRewardsDetails';

type VaultBalanceDetailsProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
  provider?: VaultProvider;
};

export function VaultBalanceDetails({
  vaultAddress,
  assetToken,
  provider = 'morpho'
}: VaultBalanceDetailsProps) {
  const chainId = useChainId();
  const { address } = useConnection();
  const {
    data: vaultData,
    isLoading: isVaultLoading,
    error: vaultError
  } = useMorphoVaultOnChainData({ vaultAddress, provider });

  const assetAddress = assetToken.address[chainId as keyof typeof assetToken.address];
  const {
    data: assetBalance,
    isLoading: isBalanceLoading,
    error: balanceError
  } = useTokenBalance({
    chainId,
    token: assetAddress,
    address
  });

  const SuppliedVaultBalanceCard = () => {
    const sharesBalance = vaultData?.userShares
      ? `(${formatBigInt(vaultData.userShares, { unit: vaultData.decimals, compact: true, maxDecimals: 2 })} shares)`
      : undefined;

    return (
      <SuppliedBalanceCard
        balance={vaultData?.userAssets || 0n}
        isLoading={isVaultLoading}
        token={assetToken}
        error={vaultError}
        label={t`Supplied balance`}
        afterBalance={sharesBalance}
        dataTestId="morpho-vault-supplied-balance-details"
      />
    );
  };

  const AssetBalanceCard = () => {
    return (
      <UnsuppliedBalanceCard
        balance={assetBalance?.value || 0n}
        isLoading={isBalanceLoading}
        token={assetToken}
        error={balanceError}
        dataTestId="morpho-vault-remaining-balance-details"
      />
    );
  };

  return (
    <div className="flex w-full flex-wrap justify-between gap-3">
      <div className="min-w-[250px] flex-1">
        <SuppliedVaultBalanceCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <AssetBalanceCard />
      </div>
      {/* Rewards source is Morpho/Merkl-specific; non-Morpho vaults have no such program. */}
      {provider === 'morpho' && <MorphoVaultRewardsDetails vaultAddress={vaultAddress} />}
    </div>
  );
}
