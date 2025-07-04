import { useSavingsData } from '@jetstreamgg/sky-hooks';
import { SuppliedBalanceCard, UnsuppliedBalanceCard } from '@/modules/ui/components/BalanceCards';
import { useTokenBalance, usdcL2Address, sUsdsL2Address } from '@jetstreamgg/sky-hooks';
import { useChainId, useAccount } from 'wagmi';
import { isL2ChainId, formatBigInt } from '@jetstreamgg/sky-utils';

export function SavingsBalanceDetails() {
  const chainId = useChainId();
  const { address } = useAccount();
  const { data, isLoading, error } = useSavingsData();
  const isL2 = isL2ChainId(chainId);
  const isRestrictedMiCa = import.meta.env.VITE_RESTRICTED_BUILD_MICA === 'true';
  const { data: usdcBalance } = useTokenBalance({
    chainId,
    address,
    token: usdcL2Address[chainId as keyof typeof usdcL2Address],
    enabled: isL2
  });

  const { data: sUsdsBalance } = useTokenBalance({
    chainId,
    address,
    token: sUsdsL2Address[chainId as keyof typeof sUsdsL2Address],
    enabled: isL2
  });

  const usdsToken = { name: 'USDS', symbol: 'USDS' };
  const usdcToken = { name: 'USDC', symbol: 'USDC', decimals: 6 };

  const SuppliedSavingsBalanceCard = () => {
    return (
      <SuppliedBalanceCard
        balance={data?.userSavingsBalance || 0n}
        isLoading={isLoading}
        token={usdsToken}
        error={error}
        afterBalance={isL2 && sUsdsBalance ? ` (${formatBigInt(sUsdsBalance.value)} sUSDS)` : undefined}
        dataTestId="savings-supplied-balance-details"
      />
    );
  };

  const UsdsBalanceCard = () => {
    return (
      <UnsuppliedBalanceCard
        balance={data?.userNstBalance || 0n}
        isLoading={isLoading}
        token={usdsToken}
        error={error}
        dataTestId="savings-remaining-balance-details"
      />
    );
  };

  const UsdcBalanceCard = () => {
    return (
      <UnsuppliedBalanceCard
        balance={usdcBalance?.value || 0n}
        isLoading={isLoading}
        token={usdcToken}
        error={error}
      />
    );
  };

  return isL2 && !isRestrictedMiCa ? (
    <div className="flex w-full flex-col gap-3">
      <div className="w-full">
        <SuppliedSavingsBalanceCard />
      </div>
      <div className="flex w-full flex-col justify-between gap-3 xl:flex-row">
        <UsdsBalanceCard />
        <UsdcBalanceCard />
      </div>
    </div>
  ) : (
    <div className="flex w-full flex-col justify-between gap-3 xl:flex-row">
      <SuppliedSavingsBalanceCard />
      <UsdsBalanceCard />
    </div>
  );
}
