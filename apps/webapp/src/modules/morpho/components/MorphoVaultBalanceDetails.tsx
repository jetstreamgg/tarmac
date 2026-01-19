import { useMorphoVaultData, useTokenBalance, Token } from '@jetstreamgg/sky-hooks';
import { formatBigInt } from '@jetstreamgg/sky-utils';
import { SuppliedBalanceCard, UnsuppliedBalanceCard } from '@/modules/ui/components/BalanceCards';
import { t } from '@lingui/core/macro';
import { useChainId } from 'wagmi';

type MorphoVaultBalanceDetailsProps = {
  vaultAddress: `0x${string}`;
  assetToken: Token;
};

export function MorphoVaultBalanceDetails({ vaultAddress, assetToken }: MorphoVaultBalanceDetailsProps) {
  const chainId = useChainId();
  const {
    data: vaultData,
    isLoading: isVaultLoading,
    error: vaultError
  } = useMorphoVaultData({ vaultAddress });

  const assetAddress = assetToken.address[chainId as keyof typeof assetToken.address];
  const {
    data: assetBalance,
    isLoading: isBalanceLoading,
    error: balanceError
  } = useTokenBalance({
    chainId,
    token: assetAddress
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
    <div className="flex w-full flex-col justify-between gap-3 xl:flex-row">
      <SuppliedVaultBalanceCard />
      <AssetBalanceCard />
    </div>
  );
}
