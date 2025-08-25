import { SavingsRateCard } from '@/modules/savings/components/SavingsRateCard';
import { SkySavingsRatePoolCard } from '@/modules/savings/components/SkySavingsRatePoolCard';
import { SavingsSuppliersCard } from '@/modules/savings/components/SavingsSuppliersCard';

export function SavingsInfoDetails() {
  return (
    <div className="flex w-full flex-wrap justify-between gap-3">
      <div className="min-w-[250px] flex-1">
        <SavingsRateCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <SkySavingsRatePoolCard />
      </div>
      <div className="min-w-[250px] flex-1">
        <SavingsSuppliersCard />
      </div>
    </div>
  );
}
