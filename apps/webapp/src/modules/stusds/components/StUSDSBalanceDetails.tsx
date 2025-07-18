import { useSavingsData } from '@jetstreamgg/sky-hooks';
import { SuppliedBalanceCard, UnsuppliedBalanceCard } from '@/modules/ui/components/BalanceCards';

export function StUSDSBalanceDetails() {
  // TODO: Replace with useStUSDSData when available
  const { data, isLoading, error } = useSavingsData();

  const usdsToken = { name: 'USDS', symbol: 'USDS' };

  const SuppliedStUSDSBalanceCard = () => {
    return (
      <SuppliedBalanceCard
        balance={data?.userSavingsBalance || 0n}
        isLoading={isLoading}
        token={usdsToken}
        error={error}
        dataTestId="stusds-supplied-balance-details"
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
        dataTestId="stusds-remaining-balance-details"
      />
    );
  };

  return (
    <div className="flex w-full flex-col justify-between gap-3 xl:flex-row">
      <SuppliedStUSDSBalanceCard />
      <UsdsBalanceCard />
    </div>
  );
}
